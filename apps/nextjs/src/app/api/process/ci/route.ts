import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { runCiAgent } from "@dw/ai/analyzers";
import { CiJobPayloadSchema } from "@dw/contracts/queue";
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
        processor: "ci",
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

  const result = CiJobPayloadSchema.safeParse(rawPayload);
  if (!result.success) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "ci",
        event: "invalid_payload",
        errors: result.error.flatten(),
      }),
    );
    // Return 400 — QStash won't retry on 4xx, preventing infinite retries
    // on a malformed payload that will never succeed
    return NextResponse.json(
      { error: "Invalid payload schema" },
      { status: 400 },
    );
  }

  const job = result.data;

  console.log(
    JSON.stringify({
      level: "info",
      processor: "ci",
      event: "received",
      runId: job.runId,
      repo: job.repoFullName,
    }),
  );

  // 3. Run the CI agent synchronously.
  // QStash waits for our response before marking the job complete.
  // Returning 500 triggers automatic retry with exponential backoff.
  try {
    await runCiAgent(job.githubPayload);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        processor: "ci",
        runId: job.runId,
        error: String(err),
      }),
    );
    // 500 → QStash retries (up to configured retry count)
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
