// Sensors only gather raw signals — no analysis logic here.
// All config reads are inside function bodies — no module-level side effects.

import type { SentryIssue, SentryIssueDetail } from "@dw/contracts";
import { config } from "@dw/config";
import { isSentryApiConfigured } from "@dw/validators/observability-env";

/**
 * Fetch the most recent unresolved issues from Sentry.
 * Returns empty array if Sentry API is not configured.
 * Used by the control loop for periodic polling.
 */
export async function fetchSentryIssues(limit = 10): Promise<SentryIssue[]> {
  if (!isSentryApiConfigured()) return [];

  // Read config inside the function — never at module initialization time.
  // Module-level config reads cause Edge runtime crashes when the module
  // is imported by Edge routes that don't need these functions.
  const org = config.observability.SENTRY_ORG;
  const project = config.observability.SENTRY_PROJECT;
  const token = config.observability.SENTRY_TOKEN;

  const url =
    `https://sentry.io/api/0/projects/${org}/${project}/issues/` +
    `?query=is:unresolved&limit=${limit}&sort=date`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${String(token)}` },
  });

  if (!res.ok) {
    console.error(
      JSON.stringify({
        level: "error",
        sensor: "sentry",
        status: res.status,
        message: "Failed to fetch Sentry issues",
      }),
    );
    return [];
  }

  return (await res.json()) as SentryIssue[];
}

/**
 * Fetch detailed info for a single Sentry issue by ID.
 * Called by the incident agent after a webhook triggers for enrichment.
 */
export async function fetchSentryIssueDetail(
  issueId: string,
): Promise<SentryIssueDetail | null> {
  if (!isSentryApiConfigured()) return null;

  const token = config.observability.SENTRY_TOKEN;

  const res = await fetch(`https://sentry.io/api/0/issues/${issueId}/`, {
    headers: { Authorization: `Bearer ${String(token)}` },
  });

  if (!res.ok) return null;
  return (await res.json()) as SentryIssueDetail;
}

/**
 * Fetch recent events (with stacktraces) for a Sentry issue.
 * Useful for enriching the webhook payload with full trace data.
 */
export async function fetchSentryIssueEvents(
  issueId: string,
  limit = 1,
): Promise<Record<string, unknown>[]> {
  if (!isSentryApiConfigured()) return [];

  const token = config.observability.SENTRY_TOKEN;

  const res = await fetch(
    `https://sentry.io/api/0/issues/${issueId}/events/?limit=${limit}&full=true`,
    { headers: { Authorization: `Bearer ${String(token)}` } },
  );

  if (!res.ok) return [];
  return (await res.json()) as Record<string, unknown>[];
}
