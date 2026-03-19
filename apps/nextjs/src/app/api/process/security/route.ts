import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { runSecurityAgent } from "@dw/ai/analyzers";
import { SecurityAlertJobPayloadSchema } from "@dw/contracts/queue";
import { verifyQStashRequest } from "@dw/qstash";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const isValid = await verifyQStashRequest(
    req.headers.get("upstash-signature"),
    rawBody,
  );
  if (!isValid) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "security",
        event: "invalid_qstash_signature",
      }),
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = SecurityAlertJobPayloadSchema.safeParse(rawPayload);
  if (!result.success) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "security",
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
      processor: "security",
      event: "received",
      alertId: job.alertId,
      action: job.action,
    }),
  );

  try {
    await runSecurityAgent(job.githubPayload);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "security",
        alertId: job.alertId,
        error: String(err),
      }),
    );
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
