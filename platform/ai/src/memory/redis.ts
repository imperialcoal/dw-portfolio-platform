import type {
  IncidentRecord,
  PlatformEvent,
  SystemHealth,
} from "@dw/contracts";
import { config } from "@dw/config";
import { getRedis } from "@dw/redis";

/**
 * Returns true when Upstash Redis is configured.
 * False in local Docker dev when using the local Upstash-compatible server.
 * Both cloud and local Docker work — this guards against missing vars entirely.
 */
export function isRedisConfigured(): boolean {
  return !!(
    config.app.UPSTASH_REDIS_REST_URL && config.app.UPSTASH_REDIS_REST_TOKEN
  );
}

// ─────────────────────────────────────────────
// Dedup — prevents re-analyzing the same event
// ─────────────────────────────────────────────

const DEDUP_TTL = {
  ci_failure: 60 * 60 * 24, // 24h
  sentry_error: 60 * 60 * 24 * 7, // 7d
} as const;

/**
 * Returns true if this event was already processed.
 * Uses SET NX (atomic) to set a dedup key with TTL.
 */
export async function isDuplicate(
  type: keyof typeof DEDUP_TTL,
  id: string,
): Promise<boolean> {
  const redis = getRedis();
  const key = `${type.replace("_", ":")}:${id}`;
  const result = await redis.set(key, "1", { nx: true, ex: DEDUP_TTL[type] });
  return result === null; // null = key already existed
}

// ─────────────────────────────────────────────
// Incident log — read by platform dashboard
// ─────────────────────────────────────────────

const INCIDENT_KEY = "platform:incidents";
const MAX_INCIDENTS = 50;
const INCIDENT_TTL = 60 * 60 * 24 * 30; // 30d

export async function logIncident(incident: IncidentRecord): Promise<void> {
  const redis = getRedis();
  await redis.lpush(INCIDENT_KEY, JSON.stringify(incident));
  await redis.ltrim(INCIDENT_KEY, 0, MAX_INCIDENTS - 1);
  await redis.expire(INCIDENT_KEY, INCIDENT_TTL);
}

export async function getIncidents(limit = 20): Promise<IncidentRecord[]> {
  const redis = getRedis();
  const items = await redis.lrange(INCIDENT_KEY, 0, limit - 1);
  return items.map((item) =>
    typeof item === "string"
      ? (JSON.parse(item) as IncidentRecord)
      : (item as IncidentRecord),
  );
}

// ─────────────────────────────────────────────
// Raw event log — full PlatformEvent history
// ─────────────────────────────────────────────

const EVENTS_KEY = "platform:events";
const MAX_EVENTS = 100;
const EVENTS_TTL = 60 * 60 * 24 * 7; // 7d

export async function logEvent(event: PlatformEvent): Promise<void> {
  const redis = getRedis();
  await redis.lpush(EVENTS_KEY, JSON.stringify(event));
  await redis.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  await redis.expire(EVENTS_KEY, EVENTS_TTL);
}

export async function getEvents(limit = 50): Promise<PlatformEvent[]> {
  const redis = getRedis();
  const items = await redis.lrange(EVENTS_KEY, 0, limit - 1);
  return items.map((item) =>
    typeof item === "string"
      ? (JSON.parse(item) as PlatformEvent)
      : (item as PlatformEvent),
  );
}

// ─────────────────────────────────────────────
// System health snapshot — for dashboard header
// ─────────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealth> {
  const incidents = await getIncidents(50);
  const cutoff = Date.now() - 1000 * 60 * 60 * 24;
  const recent = incidents.filter(
    (i) => new Date(i.timestamp).getTime() > cutoff,
  );
  const critical = recent.filter((i) => i.severity === "critical");

  let recentSeverity: SystemHealth["recentSeverity"] = "healthy";
  if (critical.length > 0) {
    recentSeverity = "critical";
  } else if (recent.some((i) => i.severity === "high")) {
    recentSeverity = "high";
  } else if (recent.some((i) => i.severity === "medium")) {
    recentSeverity = "medium";
  } else if (recent.length > 0) {
    recentSeverity = "low";
  }

  return {
    lastChecked: new Date().toISOString(),
    incidentCount24h: recent.length,
    criticalCount: critical.length,
    recentSeverity,
  };
}
