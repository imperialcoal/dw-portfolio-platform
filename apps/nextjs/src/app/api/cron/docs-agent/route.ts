import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { runDocsAgent } from "@dw/ai/analyzers";
import { config } from "@dw/config";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/docs-agent
 *
 * Triggered by Vercel cron (see vercel.json).
 * Protected by CRON_SECRET — Vercel injects this automatically for cron
 * jobs, sending Authorization: Bearer <CRON_SECRET>.
 *
 * Also accepts a ?branch= query param for manual triggering against a
 * specific branch (still requires valid secret).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${config.cron.CRON_SECRET}`) {
    console.warn(
      JSON.stringify({
        level: "warn",
        cron: "docs-agent",
        event: "unauthorized",
      }),
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branch = req.nextUrl.searchParams.get("branch") ?? "dev";

  console.log(
    JSON.stringify({
      level: "info",
      cron: "docs-agent",
      event: "triggered",
      branch,
    }),
  );

  try {
    const result = await runDocsAgent(branch);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        cron: "docs-agent",
        error: String(err),
      }),
    );
    return NextResponse.json(
      { error: "Docs agent failed", details: String(err) },
      { status: 500 },
    );
  }
}
