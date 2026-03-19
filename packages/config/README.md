# @dw/config

Unified runtime configuration object for the monorepo. Composes all per-domain environment validators from `@dw/validators` into a single frozen `config` object, providing a single import point for all runtime configuration.

## Purpose

Instead of calling individual `*Env()` functions throughout the codebase (which re-parse `process.env` on each call), `@dw/config` aggregates them into one object. Packages that need multiple env domains import `config` once rather than importing multiple validators.

## Architecture

```
src/
└── index.ts    # Composes all validators into config object
```

## Key Exports

```typescript
export const config: Readonly<{
  app: ReturnType<typeof apiEnv>; // NODE_ENV, APP_ENV
  auth: ReturnType<typeof authEnv>; // OWNER_EMAILS
  clerk: ReturnType<typeof clerkEnv>; // CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET
  db: ReturnType<typeof dbEnv>; // DATABASE_URL, DIRECT_URL
  devops: ReturnType<typeof devopsEnv>; // ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_REPO
  messaging: ReturnType<typeof messagingEnv>; // RESEND_API_KEY, RESEND_*_EMAIL
  observability: ReturnType<typeof observabilityEnv>; // SENTRY_*, VERCEL_API_TOKEN
  qstash: ReturnType<typeof qstashEnv>; // QSTASH_TOKEN, QSTASH_URL
  redis: ReturnType<typeof redisEnv>; // UPSTASH_REDIS_REST_*
  supabase: ReturnType<typeof supabaseEnv>; // SUPABASE_PROJECT_REF
}>;

export type Config = typeof config;
```

### Usage

```typescript
import { config } from "@dw/config";

// Access any env domain
const apiKey = config.devops.ANTHROPIC_API_KEY;
const dbUrl = config.db.DATABASE_URL;
const isProduction = config.app.APP_ENV === "production";
```

## Dependencies

Consumes: `@dw/validators`

Consumed by: `@dw/api`, `@dw/ai`, `@dw/llm`, `@dw/messaging`, `@dw/qstash`

## Developer Notes

> **Developer Note**
> `config` is created with `Object.freeze()` at module load time. Each domain validator (`apiEnv()`, `dbEnv()`, etc.) calls `createEnv()` from `@t3-oss/env-core` which parses and validates `process.env` at invocation time. If a required env var is missing and `skipValidation` is false, the app will crash at startup with a clear Zod error. This is intentional — fail fast rather than propagate `undefined` through the codebase. All validators use `skipValidation: !!process.env.CI` to allow CI lint/typecheck runs without full env configuration.
