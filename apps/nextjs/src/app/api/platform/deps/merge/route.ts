import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import type { MergeResult } from "@dw/contracts";
import { mergeDependabotPR } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MergeBody = z.object({
  prNumbers: z.array(z.number().int().positive()).min(1).max(20),
});

/**
 * POST /api/platform/deps/merge
 *
 * Merges one or more Dependabot PRs using squash merge.
 * Returns per-PR success/failure results.
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

  const parsed = MergeBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { prNumbers } = parsed.data;

  // Merge sequentially to avoid race conditions on the same branch
  const results: MergeResult[] = [];
  for (const prNumber of prNumbers) {
    const result = await mergeDependabotPR(prNumber);
    results.push({ prNumber, ...result });

    console.log(
      JSON.stringify({
        level: "info",
        route: "deps/merge",
        prNumber,
        success: result.success,
        error: result.error,
      }),
    );
  }

  const merged = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    ok: failed === 0,
    merged,
    failed,
    results,
  });
}
