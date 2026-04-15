// ─────────────────────────────────────────────
// AI platform types
// ─────────────────────────────────────────────

export type {
  CiFailureEvent,
  SentryErrorEvent,
  SecurityAlertEvent,
  PlatformEvent,
  VercelDeployment,
  VercelApiDeployment,
} from "./ai/events";

export type {
  IncidentDocResult,
  IncidentRecord,
  IncidentStatus,
  IncidentSummary,
} from "./ai/incidents";
export { toIncidentSummary, INCIDENT_STATUSES } from "./ai/incidents";

export type { SentryIssue, SentryIssueDetail } from "./ai/issues";

export type { SystemHealth } from "./ai/health";

export type { ControlLoopResult } from "./ai/control-loop";

export {
  normalizeGitHubWorkflowRun,
  normalizeSentryWebhook,
  normalizeSecurityAlert,
  safeId,
} from "./ai/normalize";

// ─────────────────────────────────────────────
// Zod schemas (for runtime validation)
// ─────────────────────────────────────────────

export {
  CiFailureEventSchema,
  SentryErrorEventSchema,
  SecurityAlertEventSchema,
  PlatformEventSchema,
  AnalysisResultSchema,
  IncidentRecordSchema,
} from "./ai/events-schema";

// ─────────────────────────────────────────────
// Queue job payloads (for QStash)
// ─────────────────────────────────────────────

export {
  CiJobPayloadSchema,
  SentryJobPayloadSchema,
  SecurityAlertJobPayloadSchema,
  JobPayloadSchema,
  GithubResolutionPayloadSchema,
  SentryResolutionPayloadSchema,
} from "./queue";

export type {
  CiJobPayload,
  SentryJobPayload,
  SecurityAlertJobPayload,
  JobPayload,
  GithubResolutionPayload,
  SentryResolutionPayload,
} from "./queue";

// ─────────────────────────────────────────────
// CI
// ─────────────────────────────────────────────
export type { GitHubJob } from "./ai/ci";

// ─────────────────────────────────────────────
// Repo
// ─────────────────────────────────────────────
export type { RepoFile, RepoStructure } from "./ai/repo";

// ─────────────────────────────────────────────
// Docs
// ─────────────────────────────────────────────
export type { DocsAgentResult, DriftItem, DocChangelogSpec } from "./ai/docs";

// ─────────────────────────────────────────────
// Rollback
// ─────────────────────────────────────────────
export type {
  MigrationOperationType,
  MigrationOperation,
  MigrationFile,
  RollbackPreflight,
  RollbackResult,
  RollbackRecord,
} from "./ai/rollback";

// ─────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────
export type {
  DependencyUpdateType,
  DependencyEcosystem,
  DependabotPR,
  BreakingChangeAnalysis,
  SecurityAlertWithPR,
  DependencyDashboardData,
  MergeResult,
  GitHubPR,
  GitHubDependabotAlert,
} from "./ai/deps";

// ─────────────────────────────────────────────
// User activity
// ─────────────────────────────────────────────
export type {
  UserActivityRecord,
  UserActivityEventType,
  AuthSecuritySignal,
} from "./ai/user-activity";

// ─────────────────────────────────────────────
// Maintenance mode
// ─────────────────────────────────────────────
export type { MaintenanceMode } from "./ai/maintenance";

// ─────────────────────────────────────────────
// Performance
// ─────────────────────────────────────────────
export type { PerfBaseline } from "./ai/performance";

// ─────────────────────────────────────────────
// Supabase - Database
// ─────────────────────────────────────────────
export type {
  SupabaseAdvisory,
  SupabaseTableStats,
  DbHealthMetrics,
  SupabaseRawLintResult,
} from "./ai/supabase";

// ─────────────────────────────────────────────
// Uptime
// ─────────────────────────────────────────────
export type { UptimeCheckResult, CheckDefinition } from "./ai/uptime";

// ─────────────────────────────────────────────
// Event bus
// ─────────────────────────────────────────────

export { createEventBus } from "./event-bus";
export type {
  EventBus,
  EventHandler,
  PlatformEventMap,
  PlatformEventType,
} from "./event-bus";
