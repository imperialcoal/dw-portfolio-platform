# @dw/api

The tRPC API layer for the monorepo. Defines all server-side procedures (queries and mutations), their input validation schemas, and business logic. Consumed by both the Next.js web app and the Expo mobile app for type-safe RPC.

## Purpose

Centralizes all API procedure definitions so they can be shared across apps. The `AppRouter` type exported from this package is the single source of truth for all client/server contracts.

## Architecture

```
src/
├── root.ts         # Composes all sub-routers into the appRouter
├── trpc.ts         # tRPC init: context creation, middleware chain, procedure factories
└── router/
    ├── auth.ts     # Auth procedures (session, user info)
    ├── post.ts     # Post CRUD procedures
    └── contact.ts  # Contact form submission procedure
```

### Middleware Chain

Every procedure passes through at least two middlewares:

1. `timingMiddleware` — logs execution time; adds 100–500ms artificial delay in dev to simulate network latency
2. A rate limit middleware — configurable per procedure type:
   - `publicProcedure`: 100 req/60s
   - `authProcedure`: 20 req/60s (for login flows)
   - `protectedProcedure`: 300 req/60s

`protectedProcedure` additionally calls `getAuthorityContext()` which resolves the Clerk user, provisions them in the DB if they don't exist, checks ban status, and injects the full user record into context.

`adminProcedure` extends `protectedProcedure` with an `assertAdmin()` RBAC check.

## Tech Stack

- tRPC 11 (`@trpc/server`)
- SuperJSON (transformer — handles Date, undefined, BigInt serialization)
- Zod 4 (input validation + error formatting)
- `@dw/auth` (authority context resolution)
- `@dw/db` (Drizzle ORM)
- `@dw/redis` (rate limiting)
- `@dw/runtime` (singleton context factory)

## Key Exports

```typescript
// The app router — use this type in clients
export type AppRouter = typeof appRouter;

// tRPC procedure factories
export { publicProcedure, authProcedure, protectedProcedure, adminProcedure, internalProcedure };

// Context factory — called by the Next.js route handler
export { createTRPCContext };
```

### Context Shape

```typescript
// Base context (all procedures)
type TRPCContext = {
  db: DbInstance;
  redis: Redis;
  headers: Headers;
  auth: AuthObject;
};

// Protected context (protectedProcedure and above)
type ProtectedContext = TRPCContext & AuthorityContext & {
  userId: string;
  user: AuthorityUser;
};
```

## Dependencies

Consumes: `@dw/auth`, `@dw/config`, `@dw/db`, `@dw/redis`, `@dw/runtime`

Consumed by: `@dw/nextjs`, `@dw/expo`

## Local Development

```bash
# Type check only (no build artifact needed — transpilePackages in Next.js)
pnpm typecheck

# Run integration tests (requires Docker infrastructure)
pnpm test:api:infra
```

## Developer Notes

> **Developer Note**
> The `internalProcedure` export is provided for health checks, cron jobs, and background job processors that need tRPC-style procedure ergonomics without requiring user authentication. It only uses the `timingMiddleware` and does not enforce any auth or rate limiting. Use it carefully — only in routes that are already protected by other means (e.g., QStash signature verification, internal network calls).
