export const name = "redis";

export { getRedis, redis } from "./client";
export { rateLimit } from "./rate-limit";
export { cacheKeys } from "./cache-keys";

export type { RateLimitOptions } from "./rate-limit";
