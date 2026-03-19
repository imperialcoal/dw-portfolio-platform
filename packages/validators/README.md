# @dw/validators

Per-domain environment variable validators using `@t3-oss/env-core` and Zod. Each module validates a specific subset of `process.env`, providing type-safe access and clear startup errors when required variables are missing.

## Purpose

Separates env validation into focused domains (db, auth, devops, etc.) so each package only validates the variables it needs, avoiding god-object env files. The companion `@dw/config` package composes all validators into a single `config` object.

## Architecture

```
src/
├── api-env.ts          # NODE_ENV, APP_ENV
├── auth-env.ts         # OWNER_EMAILS
├── clerk-env.ts        # CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET, AUTH_REDIRECT_PROXY_URL
├── db-env.ts           # DATABASE_URL, DIRECT_URL
├── devops-env.ts       # ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET, GITHUB_REPO
├── messaging-env.ts    # RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_AGENT_FROM_EMAIL, RESEND_TO_EMAIL
├── observability-env.ts # SENTRY_*, VERCEL_API_TOKEN, VERCEL_PROJECT_ID
├── qstash-env.ts       # QSTASH_TOKEN, QSTASH_URL, QSTASH_*_SIGNING_KEY
├── redis-env.ts        # UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
├── supabase-env.ts     # SUPABASE_PROJECT_REF, SUPABASE_SECRET_DEFAULT_KEY
└── env-schemas.ts      # Shared Zod schema utilities
```

## Key Exports

Each module exports two items:

1. A `*Env()` factory function that validates and returns typed env vars
2. One or more `is*Configured()` guard functions for graceful degradation

```typescript
// Example: devops-env.ts
export function devopsEnv(): {
  ANTHROPIC_API_KEY?: string;
  GITHUB_TOKEN?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  SENTRY_WEBHOOK_SECRET?: string;
  GITHUB_REPO?: string;
  NODE_ENV: "development" | "test" | "production";
  APP_ENV: "local" | "test" | "preview" | "production";
}

export function isDevopsConfigured(): boolean  // ANTHROPIC_API_KEY + GITHUB_TOKEN + GITHUB_REPO
export function isWebhookConfigured(type: "github" | "sentry"): boolean
```

## Export Paths

| Path | Contents |
|---|---|
| `@dw/validators` | All validators (via index.ts) |
| `@dw/validators/api-env` | `apiEnv()` |
| `@dw/validators/auth-env` | `authEnv()` |
| `@dw/validators/clerk-env` | `clerkEnv()`, `isClerkConfigured()` |
| `@dw/validators/db-env` | `dbEnv()` |
| `@dw/validators/devops-env` | `devopsEnv()`, `isDevopsConfigured()`, `isWebhookConfigured()` |
| `@dw/validators/messaging-env` | `messagingEnv()`, `isMessagingConfigured()`, `isAgentEmailConfigured()` |
| `@dw/validators/observability-env` | `observabilityEnv()`, `isSentryApiConfigured()`, `isVercelApiConfigured()` |
| `@dw/validators/qstash-env` | `qstashEnv()`, `isQStashConfigured()` |
| `@dw/validators/redis-env` | `redisEnv()`, `isRedisConfigured()` |
| `@dw/validators/supabase-env` | `supabaseEnv()`, `isSupabaseConfigured()` |

## Configuration Behavior

All validators use `skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint"`. This means:
- CI runs (lint, typecheck, format) skip validation — no env vars needed in CI for code quality checks
- Production/preview deployments validate all required variables at startup and fail with a descriptive error if any are missing

## Dependencies

No monorepo dependencies (leaf package — uses only `@t3-oss/env-core` and `zod`).

Consumed by: every package that reads environment variables
