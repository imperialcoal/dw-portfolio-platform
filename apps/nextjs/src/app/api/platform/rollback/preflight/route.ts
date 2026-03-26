import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { analyzeDeploymentMigrations } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/platform/rollback/preflight?deploymentId=X&commitSha=Y
 *
 * Fetches and classifies migrations for a deployment before executing rollback.
 * Admin-only.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deploymentId = req.nextUrl.searchParams.get("deploymentId");
  const commitSha = req.nextUrl.searchParams.get("commitSha");

  if (!deploymentId || !commitSha) {
    return NextResponse.json(
      { error: "deploymentId and commitSha are required" },
      { status: 400 },
    );
  }

  try {
    const preflight = await analyzeDeploymentMigrations(
      deploymentId,
      commitSha,
    );
    return NextResponse.json(preflight);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "rollback/preflight",
        error: String(err),
      }),
    );
    return NextResponse.json(
      { error: "Failed to analyze migrations" },
      { status: 500 },
    );
  }
}
