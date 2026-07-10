# Documentation Drift Report — 2026-07-10

**Branch**: `dev`
**Scanned at**: 2026-07-10T06:49:25.397Z
**Total items requiring attention**: 27

## Action Items

- Add 18 new route(s) to ARCHITECTURE.md API Routes table and OPERATIONS.md
- Document 3 undocumented env var(s) in OPERATIONS.md Environment Variables table
- Add 3 new cron job(s) to OPERATIONS.md Cron Jobs table
- Add 2 new webhook handler(s) to OPERATIONS.md Webhook Integrations table
- Create README.md for 1 package(s) — use Claude Code documentation prompt

> Affected docs have a dated changelog block appended at the bottom.
> Remove the block once you've addressed the items.
> For deep documentation regeneration, use the Claude Code documentation prompt.

---

## Drift Details

### New API Routes (undocumented)

- `apps/nextjs/src/app/api/cron/docs-agent/route.ts`
  Route `/api/cron/docs-agent` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/cron/health-check/route.ts`
  Route `/api/cron/health-check` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/cron/perf-baseline/route.ts`
  Route `/api/cron/perf-baseline` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/demo/route.ts`
  Route `/api/demo` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/demo/trigger/ci/route.ts`
  Route `/api/demo/trigger/ci` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/demo/trigger/sentry/route.ts`
  Route `/api/demo/trigger/sentry` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/advisories/sync/route.ts`
  Route `/api/platform/advisories/sync` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/deps/analyze/route.ts`
  Route `/api/platform/deps/analyze` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/deps/merge/route.ts`
  Route `/api/platform/deps/merge` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/deps/route.ts`
  Route `/api/platform/deps` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/docs/trigger/route.ts`
  Route `/api/platform/docs/trigger` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/health-check/trigger/route.ts`
  Route `/api/platform/health-check/trigger` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/incidents/[id]/resolve/route.ts`
  Route `/api/platform/incidents/[id]/resolve` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/maintenance/route.ts`
  Route `/api/platform/maintenance` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/rollback/execute/route.ts`
  Route `/api/platform/rollback/execute` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/rollback/preflight/route.ts`
  Route `/api/platform/rollback/preflight` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/platform/search/route.ts`
  Route `/api/platform/search` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md
- `apps/nextjs/src/app/api/test-sentry-error/route.ts`
  Route `/api/test-sentry-error` is not mentioned in documentation
  → Update: docs/ARCHITECTURE.md, docs/OPERATIONS.md

---

### New or Undocumented Env Vars

- `packages/validators/src/auth-env.ts`
  Validator `auth-env` has undocumented env vars: `RECRUITER_EMAILS`, `DEMO_USER_CLERK_ID`, `DEMO_MODE` — add to OPERATIONS.md Environment Variables
  → Update: docs/OPERATIONS.md
- `packages/validators/src/messaging-env.ts`
  Validator `messaging-env` has undocumented env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_AGENT_FROM_EMAIL`, `RESEND_TO_EMAIL` — add to OPERATIONS.md Environment Variables
  → Update: docs/OPERATIONS.md
- `packages/validators/src/resume-env.ts`
  Validator `resume-env` has undocumented env vars: `RESUME_API_URL`, `RESUME_API_KEY` — add to OPERATIONS.md Environment Variables
  → Update: docs/OPERATIONS.md

---

### New Cron Jobs (undocumented)

- `apps/nextjs/src/app/api/cron/docs-agent/route.ts`
  Cron route `/api/cron/docs-agent` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md
- `apps/nextjs/src/app/api/cron/health-check/route.ts`
  Cron route `/api/cron/health-check` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md
- `apps/nextjs/src/app/api/cron/perf-baseline/route.ts`
  Cron route `/api/cron/perf-baseline` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md

---

### New Webhook Handlers (undocumented)

- `apps/nextjs/src/app/api/webhooks/github/route.ts`
  Webhook handler `/api/webhooks/github` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md
- `apps/nextjs/src/app/api/webhooks/sentry/route.ts`
  Webhook handler `/api/webhooks/sentry` is not mentioned in OPERATIONS.md
  → Update: docs/OPERATIONS.md

---

### Missing README.md Files

- `apps/astro/README.md`
  `apps/astro` has no README.md
  → Update: apps/astro/README.md

---

## Repository Snapshot

| Metric | Count |
|---|---|
| API routes | 27 |
| Workspace packages | 26 |
| Env validators | 12 |
| Cron jobs | 3 |
| Missing READMEs | 1 |
| Empty READMEs | 0 |

---
*Generated by platform-agent · Structural diff + targeted Claude changelog*
*Use the Claude Code documentation prompt for full regeneration*
