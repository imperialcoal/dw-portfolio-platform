import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { runSentryAgent } from "@dw/ai/analyzers";
import { SentryJobPayloadSchema } from "@dw/contracts/queue";
import { verifyQStashRequest } from "@dw/qstash";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // 1. Verify request came from QStash
  const isValid = await verifyQStashRequest(
    req.headers.get("upstash-signature"),
    rawBody,
  );
  if (!isValid) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "sentry",
        event: "invalid_qstash_signature",
      }),
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate typed job payload
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = SentryJobPayloadSchema.safeParse(rawPayload);
  if (!result.success) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "sentry",
        event: "invalid_payload",
        errors: result.error.flatten(),
      }),
    );
    return NextResponse.json(
      { error: "Invalid payload schema" },
      { status: 400 },
    );
  }

  const job = result.data;

  console.log(
    JSON.stringify({
      level: "info",
      processor: "sentry",
      event: "received",
      issueId: job.issueId,
      action: job.action,
      project: job.project,
    }),
  );

  try {
    await runSentryAgent(job.sentryPayload);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "sentry",
        issueId: job.issueId,
        error: String(err),
      }),
    );
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
