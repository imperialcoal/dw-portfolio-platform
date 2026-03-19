// Agent memory layer — Redis-backed incident and event storage.
// All functions call runtimeRedis() which asserts Node.js runtime.

import type {
  IncidentRecord,
  IncidentStatus,
  PlatformEvent,
  SystemHealth,
} from "@dw/contracts";
import { runtimeRedis } from "@dw/runtime/singletons";

// ─────────────────────────────────────────────
// Key schema
//
// platform:incident:{id}        → IncidentRecord (individual, updateable)
// platform:incidents:index      → list of ids, newest first (ordered index)
// platform:events               → list of raw PlatformEvents
// ci:failure:{runId}            → dedup key (24h TTL)
// ci:commit:{sha}:{workflow}    → commit-level dedup (24h TTL)
// sentry:error:{issueId}        → dedup key (7d TTL)
// ─────────────────────────────────────────────

const INCIDENT_KEY = (id: string) => `platform:incident:${id}`;
const INCIDENT_INDEX_KEY = "platform:incidents:index";
const MAX_INCIDENTS = 100;
const INCIDENT_TTL = 60 * 60 * 24 * 30; // 30d

// ─────────────────────────────────────────────
// Dedup
// ─────────────────────────────────────────────

const DEDUP_TTL = {
  ci_failure: 60 * 60 * 24, // 24h
  sentry_error: 60 * 60 * 24 * 7, // 7d
} as const;

export async function isDuplicate(
  type: keyof typeof DEDUP_TTL,
  id: string,
): Promise<boolean> {
  const redis = runtimeRedis();
  const key = `${type.replace("_", ":")}:${id}`;
  const result = await redis.set(key, "1", { nx: true, ex: DEDUP_TTL[type] });
  return result === null;
}

// ─────────────────────────────────────────────
// Incident CRUD
// ─────────────────────────────────────────────

/**
 * Creates a new incident record. Sets status to "investigating" automatically
 * since the agent is actively running when this is called.
 */
export async function logIncident(
  incident: Omit<IncidentRecord, "status" | "updatedAt">,
): Promise<void> {
  const redis = runtimeRedis();
  const now = new Date().toISOString();

  const record: IncidentRecord = {
    ...incident,
    status: "investigating",
    updatedAt: now,
  };

  await redis.set(INCIDENT_KEY(incident.id), JSON.stringify(record), {
    ex: INCIDENT_TTL,
  });

  await redis.lpush(INCIDENT_INDEX_KEY, incident.id);
  await redis.ltrim(INCIDENT_INDEX_KEY, 0, MAX_INCIDENTS - 1);
  await redis.expire(INCIDENT_INDEX_KEY, INCIDENT_TTL);
}

/**
 * Marks an incident complete after the agent finishes fan-out.
 * Transitions from "investigating" to "open".
 */
export async function markIncidentOpen(id: string): Promise<void> {
  await updateIncidentStatus(id, "open");
}

/**
 * Updates the status of an existing incident.
 * Used by webhook handlers and the manual resolution endpoint.
 */
export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
  meta?: {
    resolvedBy?: IncidentRecord["resolvedBy"];
    resolutionNote?: string;
  },
): Promise<IncidentRecord | null> {
  const redis = runtimeRedis();
  const raw = await redis.get<string>(INCIDENT_KEY(id));
  if (!raw) return null;

  const record: IncidentRecord =
    typeof raw === "string"
      ? (JSON.parse(raw) as IncidentRecord)
      : (raw as IncidentRecord);

  const now = new Date().toISOString();
  const updated: IncidentRecord = {
    ...record,
    status,
    updatedAt: now,
    ...(status === "resolved" || status === "closed"
      ? {
          resolvedAt: now,
          resolvedBy: meta?.resolvedBy,
          resolutionNote: meta?.resolutionNote,
        }
      : {}),
  };

  await redis.set(INCIDENT_KEY(id), JSON.stringify(updated), {
    ex: INCIDENT_TTL,
  });

  console.log(
    JSON.stringify({
      level: "info",
      memory: "incident",
      event: "status_updated",
      id,
      status,
      resolvedBy: meta?.resolvedBy,
    }),
  );

  return updated;
}

/**
 * Fetches a single incident by ID.
 */
export async function getIncident(id: string): Promise<IncidentRecord | null> {
  const redis = runtimeRedis();
  const raw = await redis.get<string>(INCIDENT_KEY(id));
  if (!raw) return null;
  return typeof raw === "string"
    ? (JSON.parse(raw) as IncidentRecord)
    : (raw as IncidentRecord);
}

/**
 * Fetches incidents in order (newest first), with optional status filter.
 */
export async function getIncidents(
  limit = 20,
  statusFilter?: IncidentStatus[],
): Promise<IncidentRecord[]> {
  const redis = runtimeRedis();

  const ids = await redis.lrange(INCIDENT_INDEX_KEY, 0, MAX_INCIDENTS - 1);
  if (!ids.length) return [];

  const records = await Promise.all(
    ids.map((id) =>
      redis
        .get<string>(INCIDENT_KEY(id))
        .then((raw) =>
          raw
            ? typeof raw === "string"
              ? (JSON.parse(raw) as IncidentRecord)
              : (raw as IncidentRecord)
            : null,
        )
        .catch(() => null),
    ),
  );

  const valid = records.filter((r): r is IncidentRecord => r !== null);

  const filtered = statusFilter
    ? valid.filter((r) => statusFilter.includes(r.status))
    : valid;

  return filtered.slice(0, limit);
}

/**
 * Finds an incident by its GitHub issue number.
 * Used by the GitHub webhook to resolve incidents when issues are closed.
 */
export async function findIncidentByGithubIssue(
  issueNumber: number,
): Promise<IncidentRecord | null> {
  const incidents = await getIncidents(MAX_INCIDENTS);
  return incidents.find((i) => i.githubIssueNumber === issueNumber) ?? null;
}

/**
 * Finds an incident by its Sentry issue ID.
 * Used by the Sentry webhook to update status when issues are resolved.
 */
export async function findIncidentBySentryIssue(
  sentryIssueId: string,
): Promise<IncidentRecord | null> {
  const incidents = await getIncidents(MAX_INCIDENTS);
  return (
    incidents.find(
      (i) => i.sentryIssueId === sentryIssueId && i.type === "sentry_error",
    ) ?? null
  );
}

/**
 * Finds a security alert incident by Dependabot alert number.
 * Uses sentryIssueId field which stores the alert number for security_alert type.
 */
export async function findIncidentBySecurityAlert(
  alertId: string,
): Promise<IncidentRecord | null> {
  const incidents = await getIncidents(MAX_INCIDENTS);
  return (
    incidents.find(
      (i) => i.sentryIssueId === alertId && i.type === "security_alert",
    ) ?? null
  );
}

// ─────────────────────────────────────────────
// Raw event log
// ─────────────────────────────────────────────

const EVENTS_KEY = "platform:events";
const MAX_EVENTS = 100;
const EVENTS_TTL = 60 * 60 * 24 * 7; // 7d

export async function logEvent(event: PlatformEvent): Promise<void> {
  const redis = runtimeRedis();
  await redis.lpush(EVENTS_KEY, JSON.stringify(event));
  await redis.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  await redis.expire(EVENTS_KEY, EVENTS_TTL);
}

export async function getEvents(limit = 50): Promise<PlatformEvent[]> {
  const redis = runtimeRedis();
  const items = await redis.lrange(EVENTS_KEY, 0, limit - 1);
  return items.map((item) =>
    typeof item === "string"
      ? (JSON.parse(item) as PlatformEvent)
      : (item as PlatformEvent),
  );
}

// ─────────────────────────────────────────────
// System health
// ─────────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealth> {
  const incidents = await getIncidents(50);
  const cutoff = Date.now() - 1000 * 60 * 60 * 24;

  const recent = incidents.filter(
    (i) => new Date(i.timestamp).getTime() > cutoff,
  );
  const active = recent.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const critical = active.filter((i) => i.severity === "critical");

  let recentSeverity: SystemHealth["recentSeverity"] = "healthy";
  if (critical.length > 0) {
    recentSeverity = "critical";
  } else if (active.some((i) => i.severity === "high")) {
    recentSeverity = "high";
  } else if (active.some((i) => i.severity === "medium")) {
    recentSeverity = "medium";
  } else if (active.length > 0) {
    recentSeverity = "low";
  }

  return {
    lastChecked: new Date().toISOString(),
    incidentCount24h: recent.length,
    criticalCount: critical.length,
    recentSeverity,
  };
}
