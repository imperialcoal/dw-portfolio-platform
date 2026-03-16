import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifyGitHubSignature } from "@dw/ai/actions";
import { publishCiJob } from "@dw/qstash";
import { isQStashConfigured } from "@dw/validators/qstash-env";

export const runtime = "edge";

// Safely converts an unknown value to string — avoids no-base-to-string
function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // 1. Verify GitHub HMAC signature
  const isValid = await verifyGitHubSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Filter to workflow_run failures only
  const event = req.headers.get("x-github-event");
  if (event !== "workflow_run") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const workflowRun =
    payload.workflow_run !== null && typeof payload.workflow_run === "object"
      ? (payload.workflow_run as Record<string, unknown>)
      : null;

  const action = typeof payload.action === "string" ? payload.action : null;

  if (action !== "completed" || workflowRun?.conclusion !== "failure") {
    return NextResponse.json({ ok: true, skipped: "not a failure" });
  }

  if (!isQStashConfigured()) {
    console.warn(
      JSON.stringify({
        level: "warn",
        webhook: "github",
        message: "QStash not configured — skipping agent enqueue",
      }),
    );
    return NextResponse.json({ ok: true, skipped: "qstash_not_configured" });
  }

  // 4. Extract fields for typed job payload
  const repository =
    payload.repository !== null && typeof payload.repository === "object"
      ? (payload.repository as Record<string, unknown>)
      : {};

  // workflowRun is non-null here (guarded above) — access id directly
  const runId = safeId(workflowRun.id);
  const repoFullName =
    typeof repository.full_name === "string" ? repository.full_name : "unknown";

  // 5. Publish typed job to QStash
  const messageId = await publishCiJob({
    type: "ci.failure",
    runId,
    repoFullName,
    githubPayload: payload,
  });

  return NextResponse.json({ ok: true, queued: true, messageId });
}
