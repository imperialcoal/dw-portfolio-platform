import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export function getRedis(config: { url: string; token: string }): Redis {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const client = new Redis({
    url: config.url,
    token: config.token,
  });

  globalForRedis.redis = client;

  return client;
}

// Export typed redis instance
export const redis = new Proxy({} as Redis, {
  get(_target, prop: string) {
    if (!globalForRedis.redis) {
      throw new Error("Redis not initialized. Call getRedis() first.");
    }
    const value = globalForRedis.redis[prop as keyof Redis];
    if (typeof value === "function") {
      return value.bind(globalForRedis.redis);
    }
    return value;
  },
});
