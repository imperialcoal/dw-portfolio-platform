# @dw/redis

Redis caching and rate limiting using Upstash for the DW Portfolio Platform.

## Overview

This package provides Redis utilities for caching and rate limiting across the platform. It uses **Upstash Redis** with a REST API for serverless-friendly connections.

## Features

- **Upstash Redis REST client** for serverless environments
- **Token bucket rate limiting** with configurable windows
- **Cache key namespacing** for organized cache management
- **Local development** via Upstash emulator (Docker)
- **Type-safe cache operations** with TypeScript

## Exports

```typescript
// Redis client
export { redis, getRedis } from "./client";

// Rate limiting
export { rateLimit } from "./rate-limit";
export type { RateLimitOptions } from "./rate-limit";

// Cache key helpers
export { cacheKeys } from "./cache-keys";
```

## Usage

### Redis Client

The Redis client is initialized once per process:

```typescript
import { redis } from "@dw/redis";

// Set value with TTL
await redis.set("key", "value", { ex: 3600 }); // 1 hour

// Get value
const value = await redis.get("key");

// Get typed value
const user = await redis.get<UserType>("user:123");

// Delete value
await redis.del("key");

// Pipeline multiple operations
const pipeline = redis.pipeline();
pipeline.incr("counter");
pipeline.expire("counter", 60);
const results = await pipeline.exec();
```

### Rate Limiting

Token bucket rate limiting for API endpoints:

```typescript
import { redis, rateLimit } from "@dw/redis";

await rateLimit(redis, "user-123:api-call", {
  windowSeconds: 60,    // 60-second window
  maxRequests: 100,     // 100 requests per window
  prefix: "ratelimit",  // Key prefix
});

// Throws TRPCError if limit exceeded
```

**Used in tRPC middleware**:

```typescript
const rateLimitMiddleware = t.middleware(async ({ ctx, path, next }) => {
  const ip = ctx.headers.get("x-forwarded-for") ?? "local";

  await rateLimit(ctx.redis, `${ip}:${path}`, {
    windowSeconds: 60,
    maxRequests: 100,
  });

  return next();
});
```

### Cache Keys

Centralized cache key definitions for consistency:

```typescript
import { redis, cacheKeys } from "@dw/redis";

// Use predefined keys
const posts = await redis.get(cacheKeys.postsAll);
const user = await redis.get(cacheKeys.userById("user-123"));

// Add custom keys in cache-keys.ts
export const cacheKeys = {
  postsAll: "posts:all",
  postById: (id: string) => `post:${id}`,
  userById: (id: string) => `user:${id}`,
};
```

## Configuration

### Environment Variables

```bash
# Upstash Redis REST API
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Local Development

Use the Upstash emulator via Docker:

```bash
# Start infrastructure (includes Upstash emulator)
pnpm infra:up
```

This starts:
- **Redis**: Port 6379 (standard Redis)
- **Upstash HTTP Proxy**: Port 8079 (REST API)

### Production

Use Upstash Redis (managed service):

1. Create Redis database at [upstash.com](https://upstash.com)
2. Copy REST URL and token
3. Set environment variables:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-actual-token
```

## Rate Limiting

### How It Works

Token bucket algorithm:

1. Key format: `{prefix}:{identifier}:{bucket}`
2. Bucket = current time window
3. Increment counter on each request
4. Expire key after window duration
5. Throw error if counter exceeds limit

**Example**:

```typescript
// Request 1 at 12:00:00
rateLimit(redis, "user-123:api", { windowSeconds: 60, maxRequests: 10 });
// Key: ratelimit:user-123:api:20000 (bucket = floor(timestamp / 60))
// Count: 1

// Request 2 at 12:00:30
rateLimit(redis, "user-123:api", { windowSeconds: 60, maxRequests: 10 });
// Key: ratelimit:user-123:api:20000 (same bucket)
// Count: 2

// Request 11 at 12:00:55
rateLimit(redis, "user-123:api", { windowSeconds: 60, maxRequests: 10 });
// Key: ratelimit:user-123:api:20000
// Count: 11 > maxRequests
// Throws TRPCError
```

### Rate Limit Tiers

Defined in `@dw/api`:

- **Public**: 100 requests/minute per IP
- **Auth**: 20 requests/minute per IP (login endpoints)
- **Protected**: 300 requests/minute per IP (authenticated users)
- **Internal**: No limit (health checks, cron)

## Caching Strategy

### Cache Keys

Organized by resource type:

```typescript
cacheKeys.postsAll           // "posts:all"
cacheKeys.postById("123")    // "post:123"
cacheKeys.userById("u-123")  // "user:u-123"
```

### TTL Guidelines

- **Short-lived** (5 minutes): User profiles, session data
- **Medium-lived** (1 hour): Lists, aggregations
- **Long-lived** (24 hours): Static content, rarely changing data

### Cache Invalidation

Invalidate cache on mutations:

```typescript
// Create post
await db.insert(Post).values(newPost);
await redis.del(cacheKeys.postsAll); // Invalidate list cache

// Delete post
await db.delete(Post).where(eq(Post.id, postId));
await Promise.all([
  redis.del(cacheKeys.postsAll),
  redis.del(cacheKeys.postById(postId)),
]);
```

## Client Initialization

The Redis client is initialized lazily:

```typescript
// src/client.ts
let _redis: Redis | null = null;

export function getRedis(config?: { url: string; token: string }) {
  if (!_redis) {
    _redis = new Redis({
      url: config?.url ?? env.UPSTASH_REDIS_REST_URL,
      token: config?.token ?? env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

export const redis = getRedis();
```

## Development

```bash
# Build TypeScript
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Dependencies

- `@upstash/redis` - Upstash Redis REST client
- `@trpc/server` - For TRPCError in rate limiting
- `@t3-oss/env-core` - Environment variable validation

## Best Practices

1. **Always set TTL** on cached values to prevent memory leaks
2. **Use cache keys helper** for consistent naming
3. **Invalidate cache** on mutations that affect cached data
4. **Use pipelines** for multiple operations to reduce latency
5. **Rate limit auth endpoints** more strictly than public endpoints
6. **Fire-and-forget** cache operations where appropriate
7. **Handle Redis errors gracefully** - don't crash if cache fails

## Troubleshooting

### Connection Errors

If Redis connection fails:

1. Ensure infrastructure is running: `pnpm infra:up`
2. Verify `UPSTASH_REDIS_REST_URL` and token
3. Check Upstash emulator logs: `pnpm infra:logs`
4. Test connection: `curl $UPSTASH_REDIS_REST_URL`

### Rate Limit Issues

If rate limiting is too aggressive:

1. Adjust limits in `@dw/api` middleware
2. Use different prefixes for different rate limit tiers
3. Consider user-based rate limiting instead of IP-based

## Related Packages

- [`@dw/api`](../api/README.md) - Uses Redis for rate limiting and caching
- [`@dw/auth`](../auth/README.md) - May use Redis for session storage (future)
