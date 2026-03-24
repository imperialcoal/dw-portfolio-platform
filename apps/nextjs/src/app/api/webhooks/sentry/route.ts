import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifySentrySignature } from "@dw/ai/actions";
import { publishSentryJob, publishSentryResolution } from "@dw/qstash";
import { isQStashConfigured } from "@dw/validators/qstash-env";

import { env } from "~/env";

export const runtime = "edge";

function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "unknown";
}

// ─────────────────────────────────────────────
// Environment gate
//
// Even with separate Sentry integrations per environment, this provides
// a programmatic second layer of defense against misconfigured alerts.
//
// Rules:
//   preview → skip events tagged as production Sentry environment
//   production → skip events not tagged as production Sentry environment
//
// Unknown environment (null) is allowed through — better to process a
// potentially wrong event than to silently drop a real incident.
// ─────────────────────────────────────────────

function isSentryEnvironmentAllowed(sentryEnv: string | null): boolean {
  if (sentryEnv === null) return true;
  const isProduction = sentryEnv === "production";
  return env.NEXT_PUBLIC_APP_ENV === "production"
    ? isProduction
    : !isProduction;
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

  // ── New issue or event alert → enqueue Sentry agent ───────────────────────
  if (resource === "issue" || resource === "event_alert") {
    if (action !== "created" && action !== "triggered") {
      // ── Resolved issue → enqueue for monitoring status update ─────────────
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

    // Extract Sentry environment — lives in data.event.environment
    // Fall back to top-level payload.environment for older webhook formats
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

    // Environment gate — applied after extracting sentryEnv from the payload
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
