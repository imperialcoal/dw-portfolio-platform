import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { createRollbackRecord, updateRollbackRecord } from "@dw/ai/memory";
import { config } from "@dw/config";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const ExecuteBody = z.object({
  /** The Vercel deployment ID to roll back to */
  deploymentId: z.string(),
  /** The commit SHA of the deployment being rolled back to */
  commitSha: z.string(),
  /** Required when overallRisk === "destructive" — must equal "ROLLBACK" */
  confirmText: z.string().optional(),
  /** The assessed risk level — destructive requires confirmText */
  overallRisk: z.enum(["safe", "risky", "destructive"]),
  /** Human-readable descriptions of non-safe SQL operations */
  changes: z.array(z.string()).optional(),
});

/**
 * POST /api/platform/rollback/execute
 *
 * Executes a rollback by re-deploying a previous Vercel deployment.
 * Uses Vercel's instantRedeployment API to promote a prior deployment.
 * Writes a RollbackRecord to Redis before and after — provides a full
 * audit trail visible on the deployments page.
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

  const parsed = ExecuteBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    deploymentId,
    commitSha,
    confirmText,
    overallRisk,
    changes = [],
  } = parsed.data;

  // Hard guard: destructive migrations require explicit confirmation
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

  // Write the audit record before calling Vercel — status: executing
  // This ensures the record exists even if the request times out or errors.
  await createRollbackRecord({
    deploymentId,
    rollbackToSha: commitSha,
    riskLevel: overallRisk,
    changes,
    status: "executing",
    initiatedAt: new Date().toISOString(),
  }).catch((e: unknown) => {
    // Non-fatal — log but don't block the rollback
    console.error(
      JSON.stringify({
        level: "error",
        route: "rollback/execute",
        step: "create_record",
        error: String(e),
      }),
    );
  });

  // Vercel instant rollback: create a new deployment from a previous one
  const res = await fetch(
    `https://api.vercel.com/v13/deployments?projectId=${projectId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deploymentId,
        name: projectId,
        target: config.app.APP_ENV === "production" ? "production" : "preview",
        meta: {
          rollbackFrom: deploymentId,
          rollbackRisk: overallRisk,
          rollbackInitiatedAt: new Date().toISOString(),
        },
      }),
    },
  );

  if (!res.ok) {
    const error = (await res.json()) as { error?: { message?: string } };
    const errorMessage = error.error?.message ?? `HTTP ${res.status}`;

    console.error(
      JSON.stringify({
        level: "error",
        route: "rollback/execute",
        status: res.status,
        vercelError: error,
      }),
    );

    // Update the audit record to failed
    await updateRollbackRecord(deploymentId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    }).catch(() => {
      // Non-fatal
    });

    return NextResponse.json(
      {
        error: "Vercel rollback failed",
        details: errorMessage,
      },
      { status: 502 },
    );
  }

  const deployment = (await res.json()) as {
    id?: string;
    url?: string;
    readyState?: string;
  };

  // Update the audit record to success
  await updateRollbackRecord(deploymentId, {
    status: "success",
    completedAt: new Date().toISOString(),
    newDeploymentId: deployment.id,
  }).catch(() => {
    // Non-fatal
  });

  console.log(
    JSON.stringify({
      level: "info",
      route: "rollback/execute",
      event: "rollback_initiated",
      fromDeploymentId: deploymentId,
      newDeploymentId: deployment.id,
      overallRisk,
    }),
  );

  return NextResponse.json({
    ok: true,
    newDeploymentId: deployment.id,
    deploymentUrl: deployment.url ? `https://${deployment.url}` : undefined,
  });
}
