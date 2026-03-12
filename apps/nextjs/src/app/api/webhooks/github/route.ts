// CI failure receiver
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifyGitHubSignature } from "@dw/ai/actions";
import { runCiAgent } from "@dw/ai/analyzers";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // verifyGitHubSignature is synchronous — no await needed
  const isValid = verifyGitHubSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
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

  const event = req.headers.get("x-github-event");

  if (event === "workflow_run") {
    const workflowRun =
      payload.workflow_run !== null && typeof payload.workflow_run === "object"
        ? (payload.workflow_run as { conclusion?: string })
        : null;
    const action = typeof payload.action === "string" ? payload.action : null;

    if (action !== "completed" || workflowRun?.conclusion !== "failure") {
      return NextResponse.json({ ok: true, skipped: "not a failure" });
    }

    void runCiAgent(payload).catch((err: unknown) =>
      console.error(
        JSON.stringify({
          level: "error",
          webhook: "github",
          error: String(err),
        }),
      ),
    );

    return NextResponse.json({ ok: true, queued: true });
  }

  return NextResponse.json({ ok: true, ignored: event });
}
