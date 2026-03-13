import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

import { verifySentrySignature } from "@dw/ai/actions";
import { runSentryAgent } from "@dw/ai/analyzers";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const isValid = verifySentrySignature(
    rawBody,
    req.headers.get("sentry-hook-signature"),
  );
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resource = req.headers.get("sentry-hook-resource");

  if (resource === "issue" || resource === "event_alert") {
    waitUntil(
      runSentryAgent(payload).catch((err: unknown) =>
        console.error(
          JSON.stringify({
            level: "error",
            webhook: "sentry",
            error: String(err),
          }),
        ),
      ),
    );
    return NextResponse.json({ ok: true, queued: true });
  }

  return NextResponse.json({ ok: true, ignored: resource });
}
