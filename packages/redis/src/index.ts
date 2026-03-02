// resetRedis is for testing only — allows resetting the singleton between tests
export { getRedis, redis, clearRedis, resetRedis } from "./client";
export type { Redis } from "./client";
export { rateLimit } from "./rate-limit";
export { cacheKeys } from "./cache-keys";

export type { RateLimitOptions } from "./rate-limit";
