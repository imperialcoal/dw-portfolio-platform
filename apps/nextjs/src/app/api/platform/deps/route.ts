import { NextResponse } from "next/server";

import { getDepAnalysis } from "@dw/ai/memory";
import { fetchDependabotPRs, fetchSecurityAlerts } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/platform/deps
 *
 * Returns all open Dependabot PRs and security vulnerability alerts,
 * with cached breaking-change analyses hydrated from Redis.
 * Admin-only.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Fetch PRs first — security alert correlation needs the PR list
    const prs = await fetchDependabotPRs();

    // Fetch security vulnerability alerts, correlating with open PRs
    const securityAlerts = await fetchSecurityAlerts(prs);

    // Hydrate breaking-change analyses from Redis cache
    const analyses = await Promise.all(
      prs.map(async (pr) => {
        const analysis = await getDepAnalysis(pr.number).catch(() => null);
        return { prNumber: pr.number, analysis };
      }),
    );

    const analysisMap = Object.fromEntries(
      analyses
        .filter((a) => a.analysis !== null)
        .map((a) => [a.prNumber, a.analysis]),
    );

    // Mark PRs that have cached analyses
    const hydratedPrs = prs.map((pr) => ({
      ...pr,
      hasAnalysis: analysisMap[pr.number] !== undefined,
    }));

    return NextResponse.json({
      prs: hydratedPrs,
      securityAlerts,
      analyses: analysisMap,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "platform/deps",
        error: String(err),
      }),
    );
    return NextResponse.json(
      { error: "Failed to fetch dependency data" },
      { status: 500 },
    );
  }
}
