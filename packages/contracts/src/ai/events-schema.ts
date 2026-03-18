import { z } from "zod";

const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
const StatusSchema = z.enum([
  "open",
  "investigating",
  "monitoring",
  "resolved",
  "closed",
]);

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

export const PlatformEventSchema = z.discriminatedUnion("type", [
  CiFailureEventSchema,
  SentryErrorEventSchema,
]);

export type PlatformEventFromSchema = z.infer<typeof PlatformEventSchema>;

export const AnalysisResultSchema = z.object({
  severity: SeveritySchema,
  summary: z.string(),
  rootCause: z.string(),
  impact: z.string(),
  suggestedFix: z.string(),
  labels: z.array(z.string()),
});

export const IncidentRecordSchema = z.object({
  type: z.enum(["ci_failure", "sentry_error"]),
  id: z.string(),
  service: z.string(),
  timestamp: z.string(),
  summary: z.string(),
  rootCause: z.string(),
  severity: SeveritySchema,
  labels: z.array(z.string()),
  status: StatusSchema,
  updatedAt: z.string(),
  resolvedAt: z.string().optional(),
  resolvedBy: z
    .enum(["github_issue_closed", "sentry_resolved", "manual"])
    .optional(),
  resolutionNote: z.string().optional(),
  issueUrl: z.string().optional(),
  githubIssueNumber: z.number().optional(),
  sentryIssueId: z.string().optional(),
  incidentDocPath: z.string().optional(),
  commitSha: z.string().optional(),
  branch: z.string().optional(),
});
