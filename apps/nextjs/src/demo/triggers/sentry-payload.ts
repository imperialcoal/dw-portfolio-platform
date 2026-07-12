// Builds a synthetic SentryJobPayload that passes SentryJobPayloadSchema
// validation and exercises the full Sentry agent pipeline:
//   QStash → /api/process/sentry → runSentryAgent → Redis incident
//
// The sentryPayload shape mirrors the real Sentry issue alert webhook.
// The Sentry agent extracts issue data via data.issue — we provide enough
// structure for normalizeSentryWebhook() to produce a valid SentryErrorEvent.
//
// issueId is time-based to bypass QStash dedup on repeated demo triggers.

import type { SentryJobPayload } from "@dw/contracts/queue";

export function buildSyntheticSentryPayload(): SentryJobPayload {
  const issueId = `DEMO-${Date.now()}`;
  const now = new Date().toISOString();

  return {
    type: "sentry.incident",
    issueId,
    action: "triggered",
    project: "dw-portfolio-preview",
    sentryPayload: {
      action: "triggered",
      data: {
        issue: {
          id: issueId,
          title:
            "TypeError: Cannot read properties of undefined (reading 'role')",
          culprit:
            "apps/nextjs/src/auth/request-authority.ts in getRequestAuthority",
          level: "error",
          status: "unresolved",
          permalink: `https://sentry.io/organizations/imperial-coal/issues/${issueId}/`,
          project: {
            slug: "dw-portfolio-preview",
            name: "dw-portfolio-preview",
          },
          firstSeen: now,
          lastSeen: now,
          count: "1",
          userCount: 1,
        },
      },
      project_slug: "dw-portfolio-preview",
      triggered_rule: "Demo: High error rate",
    },
  };
}
