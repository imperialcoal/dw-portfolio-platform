import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { runDepsAgent } from "@dw/ai/analyzers";
import { fetchDependabotPRs } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const AnalyzeBody = z.object({
  prNumber: z.number().int().positive(),
});

/**
 * POST /api/platform/deps/analyze
 *
 * Triggers breaking change analysis for a major-version Dependabot PR.
 * Returns cached result if analysis already exists.
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

  const parsed = AnalyzeBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { prNumber } = parsed.data;

  // Fetch the PR to validate it's a Dependabot PR
  const prs = await fetchDependabotPRs();
  const pr = prs.find((p) => p.number === prNumber);

  if (!pr) {
    return NextResponse.json(
      { error: "PR not found or not a Dependabot PR" },
      { status: 404 },
    );
  }

  try {
    const analysis = await runDepsAgent(pr);
    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "deps/analyze",
        prNumber,
        error: String(err),
      }),
    );
    return NextResponse.json(
      { error: "Analysis failed", details: String(err) },
      { status: 500 },
    );
  }
}
