import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { createRollbackRecord, updateRollbackRecord } from "@dw/ai/memory";
import { config } from "@dw/config";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const ExecuteBody = z.object({
  deploymentId: z.string().min(1),
  deploymentUrl: z.string().min(1),
  commitSha: z.string().min(1),
  confirmText: z.string().optional().default(""),
  overallRisk: z.enum(["safe", "risky", "destructive"]),
  changes: z.array(z.string()).optional().default([]),
});

/**
 * POST /api/platform/rollback/execute
 *
 * Executes a rollback by promoting a previous Vercel deployment to live.
 * Uses Vercel's promote API which instantly swaps the live deployment
 * without rebuilding — the fastest and most reliable rollback mechanism.
 * Admin-only.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log body for debugging during development
  console.log(
    JSON.stringify({
      level: "info",
      route: "rollback/execute",
      event: "body_received",
      body,
    }),
  );

  const parsed = ExecuteBody.safeParse(body);
  if (!parsed.success) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "rollback/execute",
        event: "schema_validation_failed",
        issues: parsed.error.flatten(),
        body,
      }),
    );
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    deploymentId,
    deploymentUrl,
    commitSha: rollbackToSha,
    confirmText,
    overallRisk,
    changes,
  } = parsed.data;

  console.log(
    JSON.stringify({
      level: "info",
      route: "rollback/execute",
      event: "executing",
      deploymentId,
      deploymentUrl,
      overallRisk,
    }),
  );

  if (overallRisk === "destructive" && confirmText !== "ROLLBACK") {
    return NextResponse.json(
      { error: "Destructive rollback requires confirmText === 'ROLLBACK'" },
      { status: 422 },
    );
  }

  const vercelToken = config.observability.VERCEL_API_TOKEN;
  const projectId = config.observability.VERCEL_PROJECT_ID;

  if (!vercelToken || !projectId) {
    return NextResponse.json(
      { error: "Vercel API not configured" },
      { status: 503 },
    );
  }

  // Write audit record before calling Vercel
  await createRollbackRecord({
    deploymentId,
    rollbackToSha,
    riskLevel: overallRisk,
    changes,
    status: "executing",
    initiatedAt: new Date().toISOString(),
  }).catch((e: unknown) => {
    console.error(
      JSON.stringify({
        level: "error",
        route: "rollback/execute",
        step: "create_record",
        error: String(e),
      }),
    );
  });

  // ── Step 1: Use the deployment URL passed from the client ────────────────
  // The deployments page already has the URL from the Vercel API list response.
  // Passing it directly avoids a redundant GET /v13/deployments/{id} call
  // which requires team-scoped token permissions we don't have.
  const teamId = config.observability.VERCEL_TEAM_ID;

  // ── Step 2: Determine which alias to reassign ─────────────────────────
  // For preview: dev.dw-portfolio.dev
  // For production: dw-portfolio.dev
  // Fall back to VERCEL_DOMAIN env var or derive from APP_ENV.
  const aliasToReassign =
    config.observability.VERCEL_DOMAIN ??
    (config.app.APP_ENV === "production"
      ? "dw-portfolio.dev"
      : "dev.dw-portfolio.dev");

  // ── Step 3: Reassign the alias to the target deployment ───────────────
  // POST /v2/deployments/{id}/aliases assigns a custom domain alias to
  // an existing deployment without rebuilding — the documented rollback path.
  // The path parameter must be the deployment uid (dpl_xxx), not the URL.
  const aliasUrl = new URL(
    `https://api.vercel.com/v2/deployments/${encodeURIComponent(deploymentId)}/aliases`,
  );
  if (teamId) aliasUrl.searchParams.set("teamId", teamId);

  const res = await fetch(aliasUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ alias: aliasToReassign }),
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const error = (await res.json()) as {
        error?: { message?: string };
        message?: string;
      };
      errorMessage = error.error?.message ?? error.message ?? errorMessage;
    } catch {
      // Response wasn't JSON
    }

    console.error(
      JSON.stringify({
        level: "error",
        route: "rollback/execute",
        step: "assign_alias",
        status: res.status,
        error: errorMessage,
        deploymentId,
        alias: aliasToReassign,
      }),
    );

    await updateRollbackRecord(deploymentId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    }).catch(() => undefined);

    return NextResponse.json(
      { error: "Vercel rollback failed", details: errorMessage },
      { status: 502 },
    );
  }

  const aliasResult = (await res.json()) as {
    uid?: string;
    alias?: string;
  };

  const newDeploymentId = deploymentId;

  await updateRollbackRecord(deploymentId, {
    status: "success",
    completedAt: new Date().toISOString(),
    newDeploymentId,
  }).catch(() => undefined);

  console.log(
    JSON.stringify({
      level: "info",
      route: "rollback/execute",
      event: "rollback_complete",
      fromDeploymentId: deploymentId,
      newDeploymentId,
      alias: aliasResult.alias ?? aliasToReassign,
      overallRisk,
    }),
  );

  return NextResponse.json({
    ok: true,
    newDeploymentId,
    deploymentUrl: `https://${aliasToReassign}`,
  });
}
