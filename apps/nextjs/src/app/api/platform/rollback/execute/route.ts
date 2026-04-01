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

  const { deploymentId, commitSha, confirmText, overallRisk, changes } =
    parsed.data;

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
    rollbackToSha: commitSha,
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

  // Vercel promote API — instantly swaps the live deployment without rebuild.
  // This is the correct endpoint for rollback: it promotes an existing
  // deployment to production/preview alias without creating a new build.
  // Endpoint: POST /v10/projects/{projectId}/promote/{deploymentId}
  const teamId = config.observability.VERCEL_TEAM_ID;

  const url = new URL(
    `https://api.vercel.com/v10/projects/${projectId}/promote/${deploymentId}`,
  );
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
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
        status: res.status,
        error: errorMessage,
        deploymentId,
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

  // The promote API returns the updated deployment
  const deployment = (await res.json()) as {
    id?: string;
    uid?: string;
    url?: string;
  };

  const newDeploymentId = deployment.id ?? deployment.uid;

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
      overallRisk,
    }),
  );

  return NextResponse.json({
    ok: true,
    newDeploymentId,
    deploymentUrl: deployment.url ? `https://${deployment.url}` : undefined,
  });
}
