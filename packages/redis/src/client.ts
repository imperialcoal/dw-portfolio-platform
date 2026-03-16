import { Redis } from "@upstash/redis";

import { redisEnv } from "@dw/validators/redis-env";

export type { Redis };

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function createRedisClient(): Redis {
  const env = redisEnv();

  const isLocal =
    env.APP_ENV === "local" &&
    env.UPSTASH_REDIS_REST_URL?.startsWith("http://localhost");

  if (isLocal) {
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error(
        "Local Redis requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local",
      );
    }
    return new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  // Cloud environments — Upstash via fromEnv()
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    const missing = !env.UPSTASH_REDIS_REST_URL
      ? "UPSTASH_REDIS_REST_URL"
      : "UPSTASH_REDIS_REST_TOKEN";
    throw new Error(`Missing required environment variable: ${missing}`);
  }

  try {
    return Redis.fromEnv();
  } catch {
    throw new Error(
      "Redis initialization failed. Ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in Doppler.",
    );
  }
}

export function getRedis(): Redis {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const client = createRedisClient();
  globalForRedis.redis = client;
  return client;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop: string) {
    const client = getRedis();
    const value = client[prop as keyof Redis];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export async function clearRedis() {
  if (globalForRedis.redis) {
    await globalForRedis.redis.flushdb();
  }
}

// For testing only — resets the singleton so getRedis() re-initializes
export function resetRedis() {
  delete (globalThis as unknown as { redis?: unknown }).redis;
}
