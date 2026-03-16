import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifySentrySignature } from "@dw/ai/actions";
import { publishSentryJob } from "@dw/qstash";
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

  // 1. Verify Sentry HMAC signature
  const isValid = await verifySentrySignature(
    rawBody,
    req.headers.get("sentry-hook-signature"),
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

  // 3. Filter to issue events only
  const resource = req.headers.get("sentry-hook-resource");
  if (resource !== "issue" && resource !== "event_alert") {
    return NextResponse.json({ ok: true, ignored: resource });
  }

  if (!isQStashConfigured()) {
    console.warn(
      JSON.stringify({
        level: "warn",
        webhook: "sentry",
        message: "QStash not configured — skipping agent enqueue",
      }),
    );
    return NextResponse.json({ ok: true, skipped: "qstash_not_configured" });
  }

  // 4. Extract issue ID for typed payload
  const data =
    payload.data !== null && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};
  const issueRaw = data.issue ?? payload.issue;
  const issue =
    issueRaw !== null && typeof issueRaw === "object"
      ? (issueRaw as Record<string, unknown>)
      : {};

  // safeId handles the unknown type without triggering no-base-to-string
  const issueId = safeId(issue.id);
  const action =
    typeof payload.action === "string" ? payload.action : "unknown";
  const projectSlug =
    typeof payload.project_slug === "string" ? payload.project_slug : undefined;

  // 5. Publish typed job to QStash
  const messageId = await publishSentryJob({
    type: "sentry.incident",
    issueId,
    action,
    project: projectSlug,
    sentryPayload: payload,
  });

  return NextResponse.json({ ok: true, queued: true, messageId });
}
