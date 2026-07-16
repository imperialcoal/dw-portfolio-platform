import { z } from "zod";

// ─────────────────────────────────────────────
// CI job payload
// ─────────────────────────────────────────────

export const CiJobPayloadSchema = z.object({
  type: z.literal("ci.failure"),
  runId: z.string(),
  repoFullName: z.string(),
  githubPayload: z.record(z.string(), z.unknown()),
  /**
   * Explicit, typed demo signal — set only by buildSyntheticCiPayload().
   * Real GitHub webhook deliveries never set this field, so its absence
   * is the reliable "this is real" default. Threaded through to
   * runCiAgent() so it never has to infer demo-ness from message text
   * or synthetic-looking IDs — matching how the Sentry demo trigger uses
   * an explicit `tags: { demo: "true" }` rather than relying on inference.
   */
  isDemo: z.boolean().optional(),
});

export type CiJobPayload = z.infer<typeof CiJobPayloadSchema>;

// ─────────────────────────────────────────────
// Sentry incident job payload
// ─────────────────────────────────────────────

export const SentryJobPayloadSchema = z.object({
  type: z.literal("sentry.incident"),
  issueId: z.string(),
  action: z.string(),
  project: z.string().optional(),
  sentryPayload: z.record(z.string(), z.unknown()),
});

export type SentryJobPayload = z.infer<typeof SentryJobPayloadSchema>;

// ─────────────────────────────────────────────
// Security alert job payload
// ─────────────────────────────────────────────

export const SecurityAlertJobPayloadSchema = z.object({
  type: z.literal("security.alert"),
  alertId: z.string(),
  action: z.string(),
  githubPayload: z.record(z.string(), z.unknown()),
});

export type SecurityAlertJobPayload = z.infer<
  typeof SecurityAlertJobPayloadSchema
>;

// ─────────────────────────────────────────────
// Resolution job payloads
// ─────────────────────────────────────────────

export const GithubResolutionPayloadSchema = z.object({
  type: z.literal("github.issue_closed"),
  issueNumber: z.number(),
  issueUrl: z.string(),
});

export type GithubResolutionPayload = z.infer<
  typeof GithubResolutionPayloadSchema
>;

export const SentryResolutionPayloadSchema = z.object({
  type: z.literal("sentry.issue_resolved"),
  issueId: z.string(),
});

export type SentryResolutionPayload = z.infer<
  typeof SentryResolutionPayloadSchema
>;

// ─────────────────────────────────────────────
// Union type for all queue jobs
// ─────────────────────────────────────────────

export const JobPayloadSchema = z.discriminatedUnion("type", [
  CiJobPayloadSchema,
  SentryJobPayloadSchema,
  SecurityAlertJobPayloadSchema,
  GithubResolutionPayloadSchema,
  SentryResolutionPayloadSchema,
]);

export type JobPayload = z.infer<typeof JobPayloadSchema>;
