import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifySentrySignature } from "@dw/ai/actions";
import { safeId } from "@dw/contracts";
import { publishSentryJob, publishSentryResolution } from "@dw/qstash";
import { isQStashConfigured } from "@dw/validators/qstash-env";

import { env } from "~/env";

export const runtime = "edge";

// ─────────────────────────────────────────────
// Sentry webhook action types
//
// created   → new issue, never seen before
// triggered → alert rule fired (e.g. error rate threshold)
// regressed → issue was resolved but has reoccurred — most important to catch,
//             as it indicates a fix that didn't hold
// resolved  → issue marked resolved in Sentry → transition to "monitoring"
// ─────────────────────────────────────────────

const INCIDENT_ACTIONS = new Set(["created", "triggered", "regressed"]);

// ─────────────────────────────────────────────
// Environment gate
// ─────────────────────────────────────────────

function isSentryEnvironmentAllowed(sentryEnv: string | null): boolean {
  if (sentryEnv === null) return true;
  const isProduction = sentryEnv === "production";
  return env.NEXT_PUBLIC_APP_ENV === "production"
    ? isProduction
    : !isProduction;
}

/**
 * Extracts the Sentry issue ID from a webhook payload.
 *
 * Sentry webhook payloads have different shapes depending on trigger type:
 * - Issue alerts:  payload.data.issue.id  or  payload.issue.id
 * - Event alerts:  payload.data.event.issue_id
 * - Regressed:     same as issue alerts
 *
 * Returns empty string if no ID can be found — callers must handle this.
 */
function extractIssueId(payload: Record<string, unknown>): string {
  const data =
    payload.data !== null && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const issueRaw = data.issue ?? payload.issue;
  const issue =
    issueRaw !== null && typeof issueRaw === "object"
      ? (issueRaw as Record<string, unknown>)
      : {};

  // Primary: issue.id (standard for created/triggered/regressed)
  const fromIssue = safeId(issue.id);
  if (fromIssue) return fromIssue;

  // Fallback: data.event.issue_id (event_alert webhooks)
  const eventData =
    data.event !== null && typeof data.event === "object"
      ? (data.event as Record<string, unknown>)
      : {};
  const fromEvent = safeId(eventData.issue_id ?? eventData["issue.id"]);
  if (fromEvent) return fromEvent;

  // Last resort: group_id used in some Sentry notification formats
  const fromGroup = safeId(data.group_id ?? payload.group_id);
  if (fromGroup) return fromGroup;

  return "";
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

  if (resource === "issue" || resource === "event_alert") {
    // ── Resolved → transition to monitoring ──────────────────────────────
    if (action === "resolved") {
      const issueId = extractIssueId(payload);
      if (issueId && isQStashConfigured()) {
        const messageId = await publishSentryResolution({
          type: "sentry.issue_resolved",
          issueId,
        });
        return NextResponse.json({ ok: true, queued: true, messageId });
      }
      return NextResponse.json({ ok: true, ignored: "issue.resolved_no_id" });
    }

    // ── created / triggered / regressed → enqueue incident agent ─────────
    if (!INCIDENT_ACTIONS.has(action)) {
      return NextResponse.json({ ok: true, ignored: `issue.${action}` });
    }

    if (!isQStashConfigured()) {
      return NextResponse.json({ ok: true, skipped: "qstash_not_configured" });
    }

    const issueId = extractIssueId(payload);

    if (!issueId) {
      console.warn(
        JSON.stringify({
          level: "warn",
          webhook: "sentry",
          event: "unknown_issue_id",
          resource,
          action,
          message:
            "Could not extract issue ID — skipping to avoid dedup pollution",
        }),
      );
      return NextResponse.json({ ok: true, skipped: "unknown_issue_id" });
    }

    // Extract Sentry environment
    const data =
      payload.data !== null && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : {};
    const eventData =
      data.event !== null && typeof data.event === "object"
        ? (data.event as Record<string, unknown>)
        : {};
    const sentryEnv =
      typeof eventData.environment === "string"
        ? eventData.environment
        : typeof payload.environment === "string"
          ? payload.environment
          : null;

    if (!isSentryEnvironmentAllowed(sentryEnv)) {
      console.log(
        JSON.stringify({
          level: "info",
          webhook: "sentry",
          event: "env_gate_skip",
          sentryEnv,
          appEnv: env.NEXT_PUBLIC_APP_ENV,
        }),
      );
      return NextResponse.json({
        ok: true,
        skipped: "env_gate",
        sentryEnv,
        appEnv: env.NEXT_PUBLIC_APP_ENV,
      });
    }

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

    console.log(
      JSON.stringify({
        level: "info",
        webhook: "sentry",
        event: "queued",
        issueId,
        action,
        sentryEnv,
        messageId,
      }),
    );

    return NextResponse.json({ ok: true, queued: true, messageId });
  }

  return NextResponse.json({ ok: true, ignored: resource });
}
