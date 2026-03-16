import { z } from "zod";

// ─────────────────────────────────────────────
// CI job payload
// ─────────────────────────────────────────────

/**
 * The job payload published to QStash when a CI workflow_run failure
 * is received by the GitHub webhook route.
 *
 * Contains the minimal data needed by the CI agent — the full GitHub
 * workflow_run payload is passed through so the agent can normalize it.
 */
export const CiJobPayloadSchema = z.object({
  type: z.literal("ci.failure"),
  runId: z.string(),
  repoFullName: z.string(),
  // Full GitHub workflow_run webhook payload — passed through verbatim
  githubPayload: z.record(z.string(), z.unknown()),
});

export type CiJobPayload = z.infer<typeof CiJobPayloadSchema>;

// ─────────────────────────────────────────────
// Sentry job payload
// ─────────────────────────────────────────────

/**
 * The job payload published to QStash when a Sentry issue event
 * is received by the Sentry webhook route.
 */
export const SentryJobPayloadSchema = z.object({
  type: z.literal("sentry.incident"),
  issueId: z.string(),
  action: z.string(),
  project: z.string().optional(),
  // Full Sentry webhook payload — passed through verbatim
  sentryPayload: z.record(z.string(), z.unknown()),
});

export type SentryJobPayload = z.infer<typeof SentryJobPayloadSchema>;

// ─────────────────────────────────────────────
// Union type for all queue jobs
// ─────────────────────────────────────────────

export const JobPayloadSchema = z.discriminatedUnion("type", [
  CiJobPayloadSchema,
  SentryJobPayloadSchema,
]);

export type JobPayload = z.infer<typeof JobPayloadSchema>;
