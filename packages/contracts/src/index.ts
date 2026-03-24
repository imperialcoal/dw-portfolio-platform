// ─────────────────────────────────────────────
// AI platform types
// ─────────────────────────────────────────────

export type {
  CiFailureEvent,
  SentryErrorEvent,
  SecurityAlertEvent,
  PlatformEvent,
  VercelDeployment,
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
// Repo
// ─────────────────────────────────────────────
export type { RepoFile, RepoStructure } from "./ai/repo";

// ─────────────────────────────────────────────
// Docs
// ─────────────────────────────────────────────
export type { DocsAgentResult } from "./ai/docs";

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
