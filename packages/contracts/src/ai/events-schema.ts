import { z } from "zod";

// ─────────────────────────────────────────────
// Shared schemas
// ─────────────────────────────────────────────

const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);

// ─────────────────────────────────────────────
// CI failure event schema
// ─────────────────────────────────────────────

export const CiFailureEventSchema = z.object({
  type: z.literal("ci_failure"),
  id: z.string(),
  timestamp: z.string(),
  service: z.string(),
  context: z.object({
    workflow: z.string(),
    branch: z.string(),
    commitSha: z.string(),
    prNumber: z.number().nullable(),
    prTitle: z.string().nullable(),
    jobLogs: z.string(),
    failedStep: z.string(),
    triggeredBy: z.string(),
  }),
});

// ─────────────────────────────────────────────
// Sentry error event schema
// ─────────────────────────────────────────────

export const SentryErrorEventSchema = z.object({
  type: z.literal("sentry_error"),
  id: z.string(),
  timestamp: z.string(),
  service: z.string(),
  context: z.object({
    title: z.string(),
    culprit: z.string(),
    stacktrace: z.string(),
    route: z.string().nullable(),
    environment: z.string(),
    userCount: z.number(),
    firstSeen: z.string(),
    issueUrl: z.string(),
  }),
});

// ─────────────────────────────────────────────
// Platform event — discriminated union
// ─────────────────────────────────────────────

export const PlatformEventSchema = z.discriminatedUnion("type", [
  CiFailureEventSchema,
  SentryErrorEventSchema,
]);

export type PlatformEventFromSchema = z.infer<typeof PlatformEventSchema>;

// ─────────────────────────────────────────────
// Analysis result schema
// ─────────────────────────────────────────────

export const AnalysisResultSchema = z.object({
  severity: SeveritySchema,
  summary: z.string(),
  rootCause: z.string(),
  impact: z.string(),
  suggestedFix: z.string(),
  labels: z.array(z.string()),
});

// ─────────────────────────────────────────────
// Incident record schema
// ─────────────────────────────────────────────

export const IncidentRecordSchema = z.object({
  type: z.enum(["ci_failure", "sentry_error"]),
  id: z.string(),
  summary: z.string(),
  rootCause: z.string(),
  severity: SeveritySchema,
  labels: z.array(z.string()),
  service: z.string(),
  timestamp: z.string(),
  issueUrl: z.string().optional(),
  incidentDocPath: z.string().optional(),
});
