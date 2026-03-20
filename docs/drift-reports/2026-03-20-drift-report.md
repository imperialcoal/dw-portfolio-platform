# Documentation Drift Report — 2026-03-20

**Branch**: `dev`
**Scanned at**: 2026-03-20T22:37:04.870Z
**Total items requiring attention**: 26

## Action Items

- Add 4 new route(s) to ARCHITECTURE.md API Routes table and OPERATIONS.md
- Add 4 new package(s) to ARCHITECTURE.md Monorepo Structure section
- Review 11 new env validator(s) and update OPERATIONS.md Environment Variables table
- Add 1 new cron job(s) to OPERATIONS.md Cron Jobs table
- Add 3 new webhook handler(s) to OPERATIONS.md Webhook Integrations table
- Create README.md for 3 package(s) — use Claude Code documentation prompt

> Affected docs have a dated changelog block appended at the bottom.
> Remove the block once you've addressed the items.
> For deep documentation regeneration, use the Claude Code documentation prompt.

---

## Drift Details

### New API Routes (undocumented)

- `apps/nextjs/src/app/api/cron/docs-agent/route.ts`
  Route `/api/cron/docs-agent` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/incidents/[id]/resolve/route.ts`
  Route `/api/platform/incidents/[id]/resolve` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/sentry-example-api/route.ts`
  Route `/api/sentry-example-api` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/trpc/[trpc]/route.ts`
  Route `/api/trpc/[trpc]` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md

---

### New Packages (undocumented)

- `platform/standards/eslint/package.json`
  Package `platform/standards/eslint` (eslint) is not mentioned in ARCHITECTURE.md
  → Update: docs/ARCHITECTURE.md
- `platform/standards/prettier/package.json`
  Package `platform/standards/prettier` (prettier) is not mentioned in ARCHITECTURE.md
  → Update: docs/ARCHITECTURE.md
- `platform/standards/tailwind/package.json`
  Package `platform/standards/tailwind` (tailwind) is not mentioned in ARCHITECTURE.md
  → Update: docs/ARCHITECTURE.md
- `platform/standards/typescript/package.json`
  Package `platform/standards/typescript` (typescript) is not mentioned in ARCHITECTURE.md
  → Update: docs/ARCHITECTURE.md

---

### New Env Validators (may have new required vars)

- `packages/validators/src/api-env.ts`
  Env validator `api-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/auth-env.ts`
  Env validator `auth-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/clerk-env.ts`
  Env validator `clerk-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/cron-env.ts`
  Env validator `cron-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/db-env.ts`
  Env validator `db-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/devops-env.ts`
  Env validator `devops-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/messaging-env.ts`
  Env validator `messaging-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/observability-env.ts`
  Env validator `observability-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/qstash-env.ts`
  Env validator `qstash-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/redis-env.ts`
  Env validator `redis-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md
- `packages/validators/src/supabase-env.ts`
  Env validator `supabase-env` is not mentioned in OPERATIONS.md — may introduce new required env vars
  → Update: docs/OPERATIONS.md

---

### New Cron Jobs (undocumented)

- `apps/nextjs/src/app/api/cron/docs-agent/route.ts`
  Cron route `/api/cron/docs-agent` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md

---

### New Webhook Handlers (undocumented)

- `apps/nextjs/src/app/api/webhooks/clerk/route.ts`
  Webhook handler `/api/webhooks/clerk` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md
- `apps/nextjs/src/app/api/webhooks/github/route.ts`
  Webhook handler `/api/webhooks/github` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md
- `apps/nextjs/src/app/api/webhooks/sentry/route.ts`
  Webhook handler `/api/webhooks/sentry` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md

---

### Missing README.md Files

- `apps/README.md/README.md`
  `apps/README.md` has no README.md
  → Update: apps/README.md/README.md
- `packages/README.md/README.md`
  `packages/README.md` has no README.md
  → Update: packages/README.md/README.md
- `platform/README.md/README.md`
  `platform/README.md` has no README.md
  → Update: platform/README.md/README.md

---

## Repository Snapshot

| Metric | Count |
|---|---|
| API routes | 11 |
| Workspace packages | 25 |
| Env validators | 11 |
| Cron jobs | 1 |
| Missing READMEs | 3 |
| Empty READMEs | 0 |

---
*Generated by platform-agent · Structural diff + targeted Claude changelog*
*Use the Claude Code documentation prompt for full regeneration*
