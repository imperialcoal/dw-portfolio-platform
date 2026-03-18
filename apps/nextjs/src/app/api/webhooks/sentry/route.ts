import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifySentrySignature } from "@dw/ai/actions";
import { publishSentryJob, publishSentryResolution } from "@dw/qstash";
import { isQStashConfigured } from "@dw/validators/qstash-env";

export const runtime = "edge";

function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const isValid = await verifySentrySignature(
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
  const action = typeof payload.action === "string" ? payload.action : "";

  // ── New issue: enqueue Sentry agent ───────────────────────────────────────
  if (resource === "issue" || resource === "event_alert") {
    if (action !== "created" && action !== "triggered") {
      // ── Resolved issue: enqueue for monitoring status update ───────────────
      if (action === "resolved") {
        const data =
          payload.data !== null && typeof payload.data === "object"
            ? (payload.data as Record<string, unknown>)
            : {};
        const issueRaw = data.issue ?? payload.issue;
        const issue =
          issueRaw !== null && typeof issueRaw === "object"
            ? (issueRaw as Record<string, unknown>)
            : {};
        const issueId = safeId(issue.id);

        if (issueId && issueId !== "unknown" && isQStashConfigured()) {
          const messageId = await publishSentryResolution({
            type: "sentry.issue_resolved",
            issueId,
          });
          return NextResponse.json({ ok: true, queued: true, messageId });
        }
      }

      return NextResponse.json({ ok: true, ignored: `issue.${action}` });
    }

    if (!isQStashConfigured()) {
      return NextResponse.json({ ok: true, skipped: "qstash_not_configured" });
    }

    const data =
      payload.data !== null && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : {};
    const issueRaw = data.issue ?? payload.issue;
    const issue =
      issueRaw !== null && typeof issueRaw === "object"
        ? (issueRaw as Record<string, unknown>)
        : {};

    const issueId = safeId(issue.id);
    const projectSlug =
      typeof payload.project_slug === "string"
        ? payload.project_slug
        : undefined;

    const messageId = await publishSentryJob({
      type: "sentry.incident",
      issueId,
      action,
      project: projectSlug,
      sentryPayload: payload,
    });

    return NextResponse.json({ ok: true, queued: true, messageId });
  }

  return NextResponse.json({ ok: true, ignored: resource });
}
