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

export const SecurityAlertEventSchema = z.object({
  type: z.literal("security_alert"),
  id: z.string(),
  timestamp: z.string(),
  service: z.string(),
  context: z.object({
    alertNumber: z.number(),
    packageName: z.string(),
    ecosystem: z.string(),
    vulnerableVersionRange: z.string(),
    firstPatchedVersion: z.string().nullable(),
    ghSeverity: z.enum(["low", "medium", "high", "critical"]),
    cveId: z.string().nullable(),
    ghsaId: z.string(),
    summary: z.string(),
    alertUrl: z.string(),
    manifestPath: z.string(),
    scope: z.enum(["runtime", "development"]).nullable(),
  }),
});

export const PlatformEventSchema = z.discriminatedUnion("type", [
  CiFailureEventSchema,
  SentryErrorEventSchema,
  SecurityAlertEventSchema,
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

// Kept in sync with IncidentRecord in ./incidents.ts by hand — this schema
// has no compile-time link to that interface, so any field added there
// must be mirrored here too. Verify against packages/contracts/src/ai/incidents.ts
// whenever either one changes.
//
// `type` previously only listed 3 of the 6 real IncidentRecord.type variants
// (clerk_event, uptime_failure, supabase_advisory were missing) and this
// schema was also missing sentryIssueUrl. Neither gap was caught earlier
// because this schema has never been wired into the actual incident
// read/write path (platform/ai/src/memory/redis.ts uses raw
// JSON.stringify/JSON.parse, no Zod validation) — it's exercised only by
// its own unit tests. Fixed now, alongside adding githubIssueError, so this
// schema is accurate if it's ever actually wired into a validation boundary.
export const IncidentRecordSchema = z.object({
  type: z.enum([
    "ci_failure",
    "sentry_error",
    "security_alert",
    "clerk_event",
    "uptime_failure",
    "supabase_advisory",
  ]),
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
  githubIssueError: z.string().optional(),
  sentryIssueId: z.string().optional(),
  sentryIssueUrl: z.string().optional(),
  incidentDocPath: z.string().optional(),
  commitSha: z.string().optional(),
  branch: z.string().optional(),
});
