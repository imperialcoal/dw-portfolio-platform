import { Redis } from "@upstash/redis";

type RedisClient = Redis;

const globalForRedis = globalThis as unknown as {
  _redis?: RedisClient;
};

export function getRedis(opts: { url: string; token: string }): RedisClient {
  if (globalForRedis._redis) {
    return globalForRedis._redis;
  }

  const client = new Redis({
    url: opts.url,
    token: opts.token,
  });

  globalForRedis._redis = client;

  return client;
}

/**
 * Lazy ergonomic proxy
 * Allows: redis.get(), redis.set()
 */
export const redis: RedisClient = new Proxy({} as RedisClient, {
  get(_target, prop: keyof RedisClient) {
    const realRedis = globalForRedis._redis;

    if (!realRedis) {
      throw new Error(
        "Redis client accessed before initialization. Call getRedis() first.",
      );
    }

    return realRedis[prop];
  },
});
