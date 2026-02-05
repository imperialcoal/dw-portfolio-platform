# Packages

Shared packages that provide reusable functionality across the DW Portfolio Platform monorepo.

## Overview

This directory contains internal packages that enable code sharing between the Next.js web app and Expo mobile app while maintaining strict separation of concerns and end-to-end type safety.

## Package Dependency Graph

```
@dw/api
├─ @dw/auth
├─ @dw/db
├─ @dw/health
├─ @dw/redis
└─ @dw/validators

@dw/auth
└─ @dw/db

@dw/db
└─ (no internal deps)

@dw/redis
└─ (no internal deps)

@dw/ui
└─ (no internal deps, React peer dependency)

@dw/validators
└─ (no internal deps)

@dw/health
└─ (no internal deps)
```

## Packages

### Core Packages

#### [@dw/api](./api/README.md)

tRPC v11 API layer providing end-to-end type-safe remote procedures.

- **Purpose**: Define all API contracts in one place
- **Exports**: tRPC routers, AppRouter type, context
- **Used by**: Next.js (production), Expo (dev only for types)
- **Key features**:
  - Post management router
  - Auth status router
  - Health check router
  - Rate limiting middleware
  - Authentication context

[View documentation →](./api/README.md)

#### [@dw/db](./db/README.md)

Database layer using Drizzle ORM with PostgreSQL.

- **Purpose**: Database schema, client, and type-safe queries
- **Exports**: Drizzle client, schema, query helpers
- **Used by**: API, auth, dev-tools
- **Key features**:
  - Drizzle ORM client
  - Type-safe schema definitions
  - Migration system
  - Better Auth schema integration

[View documentation →](./db/README.md)

#### [@dw/auth](./auth/README.md)

Unified authentication layer supporting Clerk and Better Auth.

- **Purpose**: Authentication configuration and client setup
- **Exports**: Auth clients, middleware, session helpers
- **Used by**: API (context), Next.js, Expo
- **Key features**:
  - Clerk OAuth integration
  - Better Auth email/password
  - Expo authentication client
  - Middleware for protected routes

[View documentation →](./auth/README.md)

### Supporting Packages

#### [@dw/redis](./redis/README.md)

Redis caching and rate limiting using Upstash.

- **Purpose**: Caching, rate limiting, and session storage
- **Exports**: Redis client, rate limiter, cache key helpers
- **Used by**: API (middleware), Next.js
- **Key features**:
  - Upstash Redis REST client
  - Token bucket rate limiting
  - Cache key namespacing

[View documentation →](./redis/README.md)

#### [@dw/validators](./validators/README.md)

Shared Zod validation schemas.

- **Purpose**: Centralized validation logic for API inputs and forms
- **Exports**: Zod schemas, type inference helpers
- **Used by**: API (input validation), Next.js (forms), Expo (forms)
- **Key features**:
  - Post schemas
  - User schemas
  - Common validators (email, password, etc.)

[View documentation →](./validators/README.md)

#### [@dw/ui](./ui/README.md)

Web-only UI component library using shadcn/ui and Radix.

- **Purpose**: Shared React components for web applications
- **Exports**: Button, Input, Form components, etc.
- **Used by**: Next.js only (not compatible with React Native)
- **Key features**:
  - shadcn/ui components
  - Radix UI primitives
  - Tailwind CSS styling
  - Dark mode support

[View documentation →](./ui/README.md)

#### [@dw/health](./health/README.md)

Infrastructure health check utilities.

- **Purpose**: Verify database and Redis connectivity
- **Exports**: Health check functions
- **Used by**: API (health endpoints)
- **Key features**:
  - Database connectivity checks
  - Redis connectivity checks
  - Structured health status responses

[View documentation →](./health/README.md)

## Package Guidelines

### Dependency Rules

1. **Apps can depend on packages**: ✅
   - `@dw/nextjs` depends on `@dw/api`, `@dw/db`, etc.
   - `@dw/expo` depends on `@dw/api` (dev only), `@dw/auth`, etc.

2. **Packages can depend on other packages**: ✅
   - `@dw/api` depends on `@dw/db`, `@dw/auth`, etc.
   - Keep dependencies minimal and acyclic

3. **Backend code should not leak to frontend**: 🚨
   - `@dw/api` is a **dev dependency** in Expo (types only)
   - Never bundle server-side code in client applications

### Type Safety

All packages are TypeScript-first:

```typescript
// Package exports types automatically
import type { Post } from "@dw/db/schema";
import type { AppRouter } from "@dw/api";

// tRPC infers types end-to-end
const posts = await api.post.getAll(); // Type: Post[]
```

### Build Output

Most packages use TypeScript's `tsc` to build:

- **Source**: `src/index.ts`
- **Output**: `dist/index.js` + `dist/index.d.ts`
- **Config**: Extends `@dw/tsconfig`

Some packages (like `@dw/ui`) have no build step and export source directly.

### Adding a New Package

Use Turborepo's generator:

```bash
pnpm turbo gen init
```

This scaffolds:
- `package.json`
- `tsconfig.json`
- `src/index.ts`
- ESLint and Prettier configs

Then:

1. Add exports to `package.json`:
   ```json
   {
     "exports": {
       ".": {
         "types": "./dist/index.d.ts",
         "default": "./src/index.ts"
       }
     }
   }
   ```

2. Add to `pnpm-workspace.yaml` (auto-detected in `packages/*`)

3. Install in consuming package:
   ```bash
   pnpm install @dw/your-package --filter @dw/nextjs
   ```

4. Import and use:
   ```typescript
   import { something } from "@dw/your-package";
   ```

## Testing Strategy

Currently, packages don't have dedicated test files. Testing happens at the application level:

- **Integration tests**: Test tRPC procedures via Next.js API routes
- **Type tests**: TypeScript compiler ensures type safety
- **Manual tests**: Use Next.js and Expo apps to verify behavior

Future: Add Vitest for unit tests in packages.

## Development Workflow

### Watch Mode

Most packages support watch mode:

```bash
# From package directory
cd packages/api
pnpm dev

# Or use Turborepo filter
pnpm turbo dev --filter @dw/api
```

### Linting and Formatting

All packages share linting and formatting configs:

```bash
# Lint all packages
pnpm lint

# Format all packages
pnpm format:fix
```

### Type Checking

```bash
# Type-check all packages
pnpm typecheck

# Type-check specific package
pnpm turbo typecheck --filter @dw/db
```

## Common Patterns

### Environment Variables

Packages that need environment variables use `@t3-oss/env-core`:

```typescript
// packages/db/env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

### Exporting Multiple Entry Points

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./schema": "./src/schema.ts"
  }
}
```

Usage:

```typescript
import { db } from "@dw/db";
import { posts } from "@dw/db/schema";
```

## Related Documentation

- [Apps Overview](../apps/README.md)
- [Platform Standards](../platform/standards/README.md)
- [Development Workflow](../README.md#development-workflow)
