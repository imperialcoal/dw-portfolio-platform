// Agent memory layer — Redis-backed incident and event storage.
// All functions call runtimeRedis() which asserts Node.js runtime.

import type {
  BreakingChangeAnalysis,
  IncidentRecord,
  IncidentStatus,
  PlatformEvent,
  RollbackRecord,
  SystemHealth,
} from "@dw/contracts";
import { runtimeRedis } from "@dw/runtime/singletons";

// ─────────────────────────────────────────────
// Key schema
//
// platform:incident:{id}         → IncidentRecord (individual, updateable)
// platform:incidents:index       → list of ids, newest first (ordered index)
// platform:events                → list of raw PlatformEvents
// ci:failure:{runId}             → dedup key (24h TTL)
// ci:commit:{sha}:{workflow}     → commit-level dedup (24h TTL)
// sentry:error:{issueId}         → dedup key (7d TTL)
// deps:analysis:{prNumber}       → BreakingChangeAnalysis (24h TTL)
// rollback:record:{deploymentId} → RollbackRecord (7d TTL)
// ─────────────────────────────────────────────

const INCIDENT_KEY = (id: string) => `platform:incident:${id}`;
const INCIDENT_INDEX_KEY = "platform:incidents:index";
const MAX_INCIDENTS = 100;
const INCIDENT_TTL = 60 * 60 * 24 * 30; // 30d

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Parses a Redis value that is always a JSON string when non-null.
 * get<string>() returns string | null — the null case is handled by callers
 * before reaching this function, so raw is always a string here.
 * The redundant ternary `typeof raw === "string" ? JSON.parse(raw) : raw`
 * was removed because the else branch is `never` (flagged by no-unnecessary-type-assertion).
 */
function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

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

export async function markIncidentOpen(id: string): Promise<void> {
  await updateIncidentStatus(id, "open");
}

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

  const record = parseJson<IncidentRecord>(raw);
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

export async function getIncident(id: string): Promise<IncidentRecord | null> {
  const redis = runtimeRedis();
  const raw = await redis.get<string>(INCIDENT_KEY(id));
  if (!raw) return null;
  return parseJson<IncidentRecord>(raw);
}

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
        .then((raw) => (raw ? parseJson<IncidentRecord>(raw) : null))
        .catch(() => null),
    ),
  );

  const valid = records.filter((r): r is IncidentRecord => r !== null);

  const filtered = statusFilter
    ? valid.filter((r) => statusFilter.includes(r.status))
    : valid;

  return filtered.slice(0, limit);
}

export async function findIncidentByGithubIssue(
  issueNumber: number,
): Promise<IncidentRecord | null> {
  const incidents = await getIncidents(MAX_INCIDENTS);
  return incidents.find((i) => i.githubIssueNumber === issueNumber) ?? null;
}

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
    typeof item === "string" ? parseJson<PlatformEvent>(item) : item,
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

// ─────────────────────────────────────────────
// Dependency analysis cache
// ─────────────────────────────────────────────

const DEPS_ANALYSIS_KEY = (prNumber: number) => `deps:analysis:${prNumber}`;
const DEPS_ANALYSIS_TTL = 60 * 60 * 24; // 24h

export async function getDepAnalysis(
  prNumber: number,
): Promise<BreakingChangeAnalysis | null> {
  const redis = runtimeRedis();
  try {
    const raw = await redis.get<string>(DEPS_ANALYSIS_KEY(prNumber));
    if (!raw) return null;
    return parseJson<BreakingChangeAnalysis>(raw);
  } catch {
    return null;
  }
}

export async function storeDepAnalysis(
  analysis: BreakingChangeAnalysis,
): Promise<void> {
  const redis = runtimeRedis();
  await redis.set(
    DEPS_ANALYSIS_KEY(analysis.prNumber),
    JSON.stringify(analysis),
    { ex: DEPS_ANALYSIS_TTL },
  );
}

// ─────────────────────────────────────────────
// Rollback audit log
// ─────────────────────────────────────────────

const ROLLBACK_KEY = (deploymentId: string) =>
  `rollback:record:${deploymentId}`;
const ROLLBACK_TTL = 60 * 60 * 24 * 7; // 7d

export async function createRollbackRecord(
  record: RollbackRecord,
): Promise<void> {
  const redis = runtimeRedis();
  await redis.set(ROLLBACK_KEY(record.deploymentId), JSON.stringify(record), {
    ex: ROLLBACK_TTL,
  });
}

export async function updateRollbackRecord(
  deploymentId: string,
  patch: Partial<
    Pick<RollbackRecord, "status" | "completedAt" | "error" | "newDeploymentId">
  >,
): Promise<void> {
  const redis = runtimeRedis();
  const raw = await redis.get<string>(ROLLBACK_KEY(deploymentId));
  if (!raw) return;

  const existing = parseJson<RollbackRecord>(raw);
  const updated: RollbackRecord = { ...existing, ...patch };

  await redis.set(ROLLBACK_KEY(deploymentId), JSON.stringify(updated), {
    ex: ROLLBACK_TTL,
  });
}

export async function getRollbackRecord(
  deploymentId: string,
): Promise<RollbackRecord | null> {
  const redis = runtimeRedis();
  try {
    const raw = await redis.get<string>(ROLLBACK_KEY(deploymentId));
    if (!raw) return null;
    return parseJson<RollbackRecord>(raw);
  } catch {
    return null;
  }
}
