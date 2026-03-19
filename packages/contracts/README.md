# @dw/contracts

The shared type and schema layer for the platform's AI/DevOps pipeline. Defines the canonical data structures that flow between webhook receivers, QStash job queues, AI agents, and the admin dashboard. Acts as the single source of truth for event normalization, incident records, and queue job payloads.

## Purpose

Prevents type drift between the Edge-runtime webhook handlers, the Node.js AI agent processors, and the dashboard UI. Every component that touches an incident or platform event imports its types from here — not from local definitions.

## Architecture

```
src/
├── ai/
│   ├── events.ts          # PlatformEvent union: CiFailureEvent | SentryErrorEvent | SecurityAlertEvent
│   ├── events-schema.ts   # Zod schemas for runtime validation of the above
│   ├── incidents.ts       # IncidentRecord, IncidentStatus, IncidentSummary, INCIDENT_STATUSES
│   ├── issues.ts          # SentryIssue, SentryIssueDetail (from Sentry REST API)
│   ├── health.ts          # SystemHealth type
│   ├── control-loop.ts    # ControlLoopResult type
│   └── normalize.ts       # normalizeGitHubWorkflowRun(), normalizeSentryWebhook(), normalizeSecurityAlert()
├── queue.ts               # QStash job payload types + Zod schemas
├── event-bus.ts           # In-process typed event bus (PlatformEventMap, EventBus)
└── index.ts               # Re-exports everything
```

## Key Exports

```typescript
// PlatformEvent union (discriminated by .type)
type PlatformEvent = CiFailureEvent | SentryErrorEvent | SecurityAlertEvent;

// Incident record stored in Redis
interface IncidentRecord {
  id: string;
  type: "ci_failure" | "sentry_error" | "security_alert";
  status: IncidentStatus;  // "investigating" | "open" | "monitoring" | "resolved" | "closed"
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  rootCause: string;
  labels: string[];
  service: string;
  timestamp: string;
  updatedAt: string;
  // Optional fields
  issueUrl?: string;
  githubIssueNumber?: number;
  incidentDocPath?: string;
  commitSha?: string;
  branch?: string;
  sentryIssueId?: string;
  resolvedAt?: string;
  resolvedBy?: "github_issue_closed" | "sentry_resolved" | "manual";
  resolutionNote?: string;
}

// Normalization functions (raw webhook payload → typed event)
function normalizeGitHubWorkflowRun(payload, jobLogs): CiFailureEvent
function normalizeSentryWebhook(payload): SentryErrorEvent
function normalizeSecurityAlert(payload): SecurityAlertEvent

// QStash job payloads (with Zod schemas for validation)
type CiJobPayload = { type: "ci.failure"; runId: string; repoFullName: string; githubPayload: ... }
type SentryJobPayload = { type: "sentry.incident"; issueId: string; action: string; ... }
type SecurityAlertJobPayload = { type: "security.alert"; alertId: string; action: string; ... }
```

## Export Paths

| Path | Contents |
|---|---|
| `@dw/contracts` | All types and functions |
| `@dw/contracts/queue` | QStash payload types + Zod schemas only |
| `@dw/contracts/event-bus` | `createEventBus()`, `EventBus`, `PlatformEventMap` |
| `@dw/contracts/ai/events-schema` | Zod schemas for PlatformEvent validation |

## Dependencies

No monorepo dependencies (leaf package).

Consumed by: `@dw/api`, `@dw/ai`, `@dw/llm`, `@dw/nextjs`, `@dw/qstash`

## Developer Notes

> **Developer Note**
> `sentryIssueId` is a field on `IncidentRecord` that serves dual purpose: for `sentry_error` incidents it stores the Sentry issue ID; for `security_alert` incidents it stores the Dependabot alert number. The type discriminant (`incident.type`) disambiguates lookup semantics in `findIncidentBySecurityAlert()` vs `findIncidentBySentryIssue()`. This field reuse avoids a Redis schema migration while security alert tracking was added incrementally.
