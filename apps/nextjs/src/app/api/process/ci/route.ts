// QStash delivery endpoint for CI failure jobs.
// Runs in Node.js runtime (fetchCiJobDetails requires TCP → GitHub API).
//
// Called by QStash after the Edge webhook handler enqueues the job.
// Returns 500 on agent failure so QStash retries automatically (up to 3x).
// Returns 400 on schema validation failure — QStash will NOT retry 4xx.

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
    // 400 — QStash will not retry malformed payloads
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
  //
  // repoFullName is passed separately — the agent uses it as the first
  // argument to fetchCiJobDetails(repo, runId). It's validated by the
  // CiJobPayloadSchema above so it's guaranteed to be a non-empty string.
  try {
    await runCiAgent(job.githubPayload, job.repoFullName);
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
    // 500 → QStash retries
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
