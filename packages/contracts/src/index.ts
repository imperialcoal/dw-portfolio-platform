// ─────────────────────────────────────────────
// AI platform types
// ─────────────────────────────────────────────

export type {
  CiFailureEvent,
  SentryErrorEvent,
  PlatformEvent,
  VercelDeployment,
} from "./ai/events";

export type { IncidentDocResult, IncidentRecord } from "./ai/incidents";

export type { SentryIssue, SentryIssueDetail } from "./ai/issues";

export type { SystemHealth } from "./ai/health";

export type { ControlLoopResult } from "./ai/control-loop";

export {
  normalizeGitHubWorkflowRun,
  normalizeSentryWebhook,
} from "./ai/normalize";

// ─────────────────────────────────────────────
// Zod schemas (for runtime validation)
// ─────────────────────────────────────────────

export {
  CiFailureEventSchema,
  SentryErrorEventSchema,
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
  JobPayloadSchema,
} from "./queue";

export type { CiJobPayload, SentryJobPayload, JobPayload } from "./queue";

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
