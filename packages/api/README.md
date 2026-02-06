# @dw/api

tRPC v11 API layer providing end-to-end type-safe remote procedures for the DW Portfolio Platform.

## Overview

This package defines the entire backend API surface using tRPC, ensuring complete type safety from the database to the client. All API routes, procedures, context, and middleware are centralized here.

**Key principle**: This package should be a **production dependency** in Next.js and a **dev dependency only** in Expo (for types).

## Features

- **tRPC v11** for type-safe API contracts
- **Procedure types**: Public, protected, auth, internal
- **Rate limiting** via Redis with configurable limits per procedure type
- **Caching** with Redis for optimized queries
- **Authentication context** with user profile loading
- **Middleware**: Timing, rate limiting, auth checks
- **SuperJSON** for advanced type serialization (Dates, Maps, Sets, etc.)
- **Zod error formatting** for structured validation errors

## Exports

```typescript
// Main router and type
export { appRouter } from "./root";
export type { AppRouter } from "./root";

// Context factory
export { createTRPCContext } from "./trpc";

// Procedure creators (for internal use)
export {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  authProcedure,
  internalProcedure,
} from "./trpc";
```

## Available Routers

### Post Router (`post`)

Manages blog posts or content items.

```typescript
// Procedures
post.all()              // Get all posts (public, cached)
post.byId({ id })       // Get single post by ID (public, cached)
post.create({ ... })    // Create post (protected)
post.delete(id)         // Delete post (protected)
```

**Features**:

- Public queries with Redis caching (1-hour TTL)
- Cache invalidation on mutations
- Author ID automatically set from authenticated user

### Auth Router (`auth`)

Authentication and health check endpoints.

```typescript
// Procedures
auth.getUser(); // Get current user profile (protected)
auth.getSecretMessage(); // Example protected endpoint
auth.testRedis(); // Redis health check (internal)
auth.testDb(); // Database health check (internal)
```

**Features**:

- User profile retrieval with caching
- Infrastructure health checks for monitoring

## Procedure Types

### Public Procedure

No authentication required. Rate limited to 100 requests/minute per IP.

```typescript
export const exampleRouter = {
  publicQuery: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      // ctx.auth may be null
      return ctx.db.query.someTable.findFirst();
    }),
};
```

### Protected Procedure

Requires authentication. Rate limited to 300 requests/minute per IP.

```typescript
export const exampleRouter = {
  protectedQuery: protectedProcedure
    .input(z.object({ title: z.string() }))
    .mutation(({ ctx, input }) => {
      // ctx.userId is guaranteed to exist
      // ctx.user contains full user profile
      return ctx.db.insert(posts).values({
        ...input,
        authorId: ctx.user.id,
      });
    }),
};
```

**Protected context includes**:

- `ctx.userId`: Clerk user ID (string)
- `ctx.user`: Full user profile from database
- `ctx.db`: Drizzle database client
- `ctx.redis`: Redis client
- `ctx.headers`: Request headers

**Automatic checks**:

- User exists in database
- User is not soft-deleted (`deletedAt` is null)
- User is not banned
- Updates `lastSeenAt` timestamp

### Auth Procedure

For login/registration endpoints. Rate limited to 20 requests/minute per IP.

```typescript
export const authRouter = {
  login: authProcedure.input(loginSchema).mutation(({ ctx, input }) => {
    // Strict rate limiting for auth endpoints
  }),
};
```

### Internal Procedure

For health checks, cron jobs, and internal operations. No rate limiting.

```typescript
export const internalRouter = {
  healthCheck: internalProcedure.query(({ ctx }) => {
    return { status: "ok", timestamp: Date.now() };
  }),
};
```

## Context

The tRPC context provides access to infrastructure and user data:

```typescript
type Context = {
  db: DrizzleDB; // Database client
  redis: RedisClient; // Redis client
  headers: Headers; // Request headers
  auth: AuthObject; // Clerk auth object
};

// In protected procedures, context is enriched:
type ProtectedContext = Context & {
  userId: string; // Clerk user ID
  user: UserProfile; // Full user from database
};
```

## Middleware

### Timing Middleware

Logs procedure execution time and adds artificial delay in development (100-500ms) to catch waterfall issues.

```
[TRPC] post.all took 234ms to execute
```

### Rate Limiting Middleware

Token bucket rate limiting per IP address using Redis:

- **Public**: 100 requests/60 seconds
- **Auth**: 20 requests/60 seconds
- **Protected**: 300 requests/60 seconds
- **Internal**: No limit

Rate limit errors return `TRPCError` with code `TOO_MANY_REQUESTS`.

### Authentication Middleware

Runs on protected procedures:

1. Verify Clerk authentication (userId exists)
2. Try to load user from Redis cache (5-minute TTL)
3. If not cached, load from database
4. Verify user is not deleted or banned
5. Update `lastSeenAt` timestamp (fire-and-forget)
6. Cache user profile in Redis
7. Enrich context with `userId` and `user`

## Error Handling

Zod validation errors are formatted for client consumption:

```typescript
// Server-side validation error
input(z.object({ title: z.string().min(3) }))

// Client receives structured error:
{
  code: "BAD_REQUEST",
  message: "Validation error",
  data: {
    zodError: {
      fieldErrors: {
        title: ["String must contain at least 3 character(s)"]
      }
    }
  }
}
```

## Adding a New Router

1. Create router file:

```typescript
// src/router/example.ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { protectedProcedure, publicProcedure } from "../trpc";

export const exampleRouter = {
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.query.examples.findMany();
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(examples).values({
        ...input,
        userId: ctx.userId,
      });
    }),
} satisfies TRPCRouterRecord;
```

2. Register in root router:

```typescript
// src/root.ts
import { exampleRouter } from "./router/example";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  post: postRouter,
  example: exampleRouter, // Add new router
});
```

3. Use in clients:

```typescript
// Next.js
const examples = await api.example.list();

// Client component
const { data } = api.example.list.useQuery();
```

## Usage in Next.js

### Server Components (RSC)

```typescript
import { api } from "~/trpc/server";

export default async function Page() {
  const posts = await api.post.all();
  return <PostList posts={posts} />;
}
```

### Client Components

```typescript
"use client";
import { api } from "~/trpc/react";

export function CreatePost() {
  const utils = api.useUtils();
  const { mutate, isPending } = api.post.create.useMutation({
    onSuccess: () => {
      // Invalidate cache to refetch
      utils.post.all.invalidate();
    },
  });

  return (
    <button
      onClick={() => mutate({ title: "Hello", content: "World" })}
      disabled={isPending}
    >
      Create
    </button>
  );
}
```

## Usage in Expo

**Important**: Add as **dev dependency only** in Expo's `package.json`.

```typescript
import { api } from "~/utils/api";

export function PostList() {
  const { data: posts, isLoading } = api.post.all.useQuery();

  if (isLoading) return <ActivityIndicator />;

  return <FlatList data={posts} renderItem={({ item }) => ...} />;
}
```

## Caching Strategy

Queries are cached in Redis with appropriate TTLs:

- **Post list**: 1 hour
- **Single post**: 1 hour
- **User profile**: 5 minutes (in protected procedure middleware)

Cache invalidation:

- `post.create`: Invalidates `postsAll` cache
- `post.delete`: Invalidates `postsAll` and `postById` cache

## Infrastructure Bootstrap

In non-production environments, the API automatically bootstraps infrastructure on first import:

```typescript
// src/trpc.ts
if (env.NODE_ENV !== "production") {
  await bootstrapInfra(); // Verifies DB, Redis, runs migrations
}
```

This ensures local development "just works" after `pnpm infra:up`.

## Dependencies

- `@trpc/server` - tRPC server runtime
- `@dw/db` - Database layer
- `@dw/redis` - Redis caching and rate limiting
- `@dw/auth` - Authentication context
- `@dw/validators` - Zod validation schemas
- `@dw/health` - Health check utilities
- `@clerk/backend` - Clerk authentication
- `superjson` - Advanced type serialization
- `zod` - Schema validation

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

## Best Practices

1. **Always use input validation** with Zod schemas
2. **Prefer publicProcedure** unless auth is truly required
3. **Cache expensive queries** in Redis with appropriate TTLs
4. **Invalidate cache** on mutations that affect cached data
5. **Use protectedProcedure** for user-specific operations
6. **Keep routers focused** - one router per domain/resource
7. **Export types** for use in validators package
8. **Fire-and-forget** for non-critical operations (logging, analytics)

## Related Packages

- [`@dw/db`](../db/README.md) - Database layer
- [`@dw/redis`](../redis/README.md) - Redis utilities
- [`@dw/auth`](../auth/README.md) - Authentication
- [`@dw/validators`](../validators/README.md) - Validation schemas
