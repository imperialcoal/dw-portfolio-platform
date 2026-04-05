// Redis functions for user activity, maintenance mode, and performance baselines.
// Follows the same pattern as redis.ts.

import type { UserActivityRecord } from "@dw/contracts";
import { runtimeRedis } from "@dw/runtime/singletons";

// ─────────────────────────────────────────────
// Key schema additions
//
// platform:user-activity:{id}      → UserActivityRecord (30d TTL)
// platform:user-activity:index     → list of ids, newest first (30d TTL)
// platform:auth:sessions:{userId}  → failed session count (1h TTL)
// ─────────────────────────────────────────────

const ACTIVITY_KEY = (id: string) => `platform:user-activity:${id}`;
const ACTIVITY_INDEX_KEY = "platform:user-activity:index";
const MAX_ACTIVITY = 200;
const ACTIVITY_TTL = 60 * 60 * 24 * 30; // 30d

const FAILED_SESSIONS_KEY = (userId: string) =>
  `platform:auth:sessions:${userId}`;
const FAILED_SESSIONS_TTL = 60 * 60; // 1h — rolling window

// ─────────────────────────────────────────────
// User Activity
// ─────────────────────────────────────────────

export async function logUserActivity(
  record: UserActivityRecord,
): Promise<void> {
  const redis = runtimeRedis();
  await redis.set(ACTIVITY_KEY(record.id), JSON.stringify(record), {
    ex: ACTIVITY_TTL,
  });
  await redis.lpush(ACTIVITY_INDEX_KEY, record.id);
  await redis.ltrim(ACTIVITY_INDEX_KEY, 0, MAX_ACTIVITY - 1);
  await redis.expire(ACTIVITY_INDEX_KEY, ACTIVITY_TTL);
}

export async function getUserActivity(
  limit = 50,
): Promise<UserActivityRecord[]> {
  const redis = runtimeRedis();
  const ids = await redis.lrange(ACTIVITY_INDEX_KEY, 0, limit - 1);
  if (!ids.length) return [];

  const records = await Promise.all(
    ids.map((id) =>
      redis
        .get<string>(ACTIVITY_KEY(id))
        .then((raw) =>
          raw
            ? typeof raw === "string"
              ? (JSON.parse(raw) as UserActivityRecord)
              : (raw as UserActivityRecord)
            : null,
        )
        .catch(() => null),
    ),
  );

  return records.filter((r): r is UserActivityRecord => r !== null);
}

// Returns new count. If > threshold, caller should create an incident.
export async function incrementFailedSessions(userId: string): Promise<number> {
  const redis = runtimeRedis();
  const key = FAILED_SESSIONS_KEY(userId);
  const count = await redis.incr(key);
  // Reset TTL on each increment so window is rolling
  await redis.expire(key, FAILED_SESSIONS_TTL);
  return count;
}

export async function getFailedSessionCount(userId: string): Promise<number> {
  const redis = runtimeRedis();
  const raw = await redis.get<string>(FAILED_SESSIONS_KEY(userId));
  if (!raw) return 0;
  return parseInt(typeof raw === "string" ? raw : String(raw), 10) || 0;
}

export async function clearFailedSessions(userId: string): Promise<void> {
  const redis = runtimeRedis();
  await redis.del(FAILED_SESSIONS_KEY(userId));
}
