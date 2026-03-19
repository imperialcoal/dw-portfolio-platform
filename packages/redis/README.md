# @dw/redis

Upstash Redis client singleton and rate-limiting middleware. Provides a lazy proxy (`redis`) for safe import at module load time, a `getRedis()` factory that handles both local Docker and cloud Upstash configurations, and a `rateLimit()` helper used by the tRPC middleware chain.

## Purpose

Centralizes Redis client initialization and provides a consistent interface whether running against the local Docker Upstash-compatible proxy (`hiett/serverless-redis-http` on port 8079) or the production Upstash REST API.

## Architecture

```
src/
├── client.ts       # getRedis() singleton, lazy redis proxy, clearRedis(), resetRedis()
├── rate-limit.ts   # rateLimit() sliding window rate limiter
├── cache-keys.ts   # Centralized key constants (if any)
└── index.ts        # Re-exports
```

## Key Exports

```typescript
// Lazy proxy — safe to import at module load time
export const redis: Redis

// Factory
export function getRedis(): Redis
export type { Redis }

// Rate limiter (used in tRPC middleware)
export async function rateLimit(
  redis: Redis,
  key: string,
  opts: { windowSeconds: number; maxRequests: number; prefix?: string }
): Promise<void>  // throws TooManyRequestsError on limit exceeded

// Test utilities
export async function clearRedis(): Promise<void>  // flushes all keys
export function resetRedis(): void                  // resets singleton for test isolation
```

### Local vs. Cloud Behavior

The client detects `APP_ENV === "local"` with a `localhost` URL:
- **Local**: Creates `new Redis({ url, token })` pointing to the Docker HTTP proxy on port 8079
- **Cloud**: Uses `Redis.fromEnv()` which reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

Both use the same Upstash REST API interface — the Docker proxy (`hiett/serverless-redis-http`) emulates Upstash's HTTP API.

## Dependencies

Consumes: `@dw/validators` (for `redisEnv()`)

Consumed by: `@dw/api`, `@dw/auth`, `@dw/ai`, `@dw/runtime`

## Developer Notes

> **Developer Note**
> `clearRedis()` and `resetRedis()` are exported for test isolation. `clearRedis()` calls `FLUSHDB` — do not call this in production code. `resetRedis()` deletes the global singleton so the next `getRedis()` call reinitializes the client, which is useful between tests that need different Redis configurations.
