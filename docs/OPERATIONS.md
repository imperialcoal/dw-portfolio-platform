# Operations Guide

## Infrastructure Overview

| Concern        | Provider                 | Environment                                                 |
| -------------- | ------------------------ | ----------------------------------------------------------- |
| Web hosting    | Vercel                   | preview (dev branch) / production (main branch)             |
| Database       | Supabase (PostgreSQL 16) | per-environment Supabase project                            |
| Cache / queues | Upstash (Redis + QStash) | per-environment Upstash databases                           |
| DNS + tunnels  | Cloudflare               | shared zone `dw-portfolio.dev`                              |
| Secrets        | Doppler                  | `dw-portfolio-platform` project, `dev` config locally       |
| Monitoring     | Sentry                   | `dw-portfolio-preview` / `dw-portfolio-production` projects |
| IaC            | Terraform 1.14.x         | state in Cloudflare R2 bucket                               |

**URLs:**

- Production: `https://dw-portfolio.dev`
- Preview (dev branch): `https://dev.dw-portfolio.dev`
- Local dev tunnel: `https://tunnel.dw-portfolio.dev` (via `cloudflared`)

---

## Environment Variables

All secrets are managed via Doppler (`doppler.yaml` maps to project `dw-portfolio-platform`, config `dev`). The table below covers every variable referenced in `turbo.json` `globalEnv` and `globalPassThroughEnv` sections.

### Core Application

| Variable              | Purpose                                     | Required | Source   |
| --------------------- | ------------------------------------------- | -------- | -------- |
| `NODE_ENV`            | `development` / `test` / `production`       | Yes      | Auto-set |
| `APP_ENV`             | `local` / `test` / `preview` / `production` | Yes      | Doppler  |
| `NEXT_PUBLIC_APP_URL` | Public URL of the Next.js app               | Yes      | Doppler  |
| `NEXT_PUBLIC_APP_ENV` | Client-side env indicator                   | Yes      | Doppler  |
| `OWNER_EMAILS`        | Comma-separated admin email addresses       | Optional | Doppler  |

### Database (Supabase / PostgreSQL)

| Variable                                       | Purpose                                | Required       | Source                       |
| ---------------------------------------------- | -------------------------------------- | -------------- | ---------------------------- |
| `DATABASE_URL`                                 | Pooled connection via PgBouncer        | Yes            | Doppler / Supabase dashboard |
| `DIRECT_URL`                                   | Direct connection (migrations only)    | Yes            | Doppler / Supabase dashboard |
| `SUPABASE_PROJECT_REF`                         | Project ID for Supabase API calls      | Optional       | Supabase dashboard           |
| `SUPABASE_SECRET_DEFAULT_KEY`                  | Service role key for admin operations  | Optional       | Supabase dashboard           |
| `NEXT_PUBLIC_SUPABASE_URL`                     | Public Supabase project URL            | Optional       | Supabase dashboard           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Anon key for client-side Supabase      | Optional       | Supabase dashboard           |
| `SUPABASE_ACCESS_TOKEN`                        | Supabase CLI / Terraform access token  | Terraform only | Supabase dashboard           |
| `SUPABASE_DB_PASSWORD`                         | DB password for Terraform provisioning | Terraform only | Doppler                      |

For local dev, Docker runs Postgres on port `5433`. Use:

```
DATABASE_URL=postgresql://postgres:password@localhost:5433/dw_test
DIRECT_URL=postgresql://postgres:password@localhost:5433/dw_test
```

### Authentication (Clerk)

| Variable                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Required         | Source          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------- |
| `CLERK_SECRET_KEY`                  | Server-side Clerk API key                                                                                                                                                                                                                                                                                                                                                                                                                                   | Yes (auth)       | Clerk dashboard |
| `CLERK_WEBHOOK_SECRET`              | Verifies incoming Clerk webhooks (`/api/webhooks/clerk`). **Endpoint-specific, not instance-wide** — `stg` and `prd` each have their own registered webhook endpoint on the same Clerk Production instance (see note below), and Clerk issues a distinct signing secret per endpoint. This value differs between `stg` and `prd` even though the instance itself is shared.                                                                                 | Yes (auth)       | Clerk dashboard |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client-side Clerk key. Same literal value in `stg` and `prd` — see note below.                                                                                                                                                                                                                                                                                                                                                                              | Yes (auth)       | Clerk dashboard |
| `CLERK_APP_ID`                      | Clerk Application identifier. Confirmed usage: builds the "View in Clerk" deep link on `/platform/users` and `/platform/search` (`https://dashboard.clerk.com/apps/{CLERK_APP_ID}/instances/{CLERK_INSTANCE_ID}/...`) — not used for auth or webhook verification. One Application contains both the Development and Production instances, so this value does not change based on which instance a given environment uses.                                  | Optional         | Clerk dashboard |
| `CLERK_INSTANCE_ID`                 | Clerk instance identifier, paired with `CLERK_APP_ID` for the same deep-link purpose. **Now identical in `stg` and `prd`** — both point at the same Clerk Production instance (see note below); previously `stg` referenced a separate Development instance, so this value changed as part of that migration.                                                                                                                                               | Optional         | Clerk dashboard |
| `DEMO_MODE`                         | Master switch for the recruiter demo overlay (`DemoHomePage`, `/api/demo`, recruiter banner, disabled deep links, demo incident triggers). Set to `"true"` in `stg` only — **never `prd`**, since production is intentionally a closed door (deploy-history-only, no live/demo traffic).                                                                                                                                                                    | Yes (`stg` only) | Doppler         |
| `RECRUITER_EMAILS`                  | Comma-separated allowlist matched against a Clerk user's primary email in the `user.created`/`user.updated` webhook handler — a match assigns the `recruiter` role in both the app's `user` table and Clerk's `publicMetadata`. `stg`-only, alongside `DEMO_MODE`. Uses a real, deliverable email (Gmail plus-addressing, e.g. `you+recruiter-demo@gmail.com`) rather than Clerk's `+clerk_test@` pattern, which only works against a Development instance. | Yes (`stg` only) | Doppler         |
| `DEMO_USER_CLERK_ID`                | The Clerk `user_...` ID of the single pre-provisioned identity `/api/demo` mints a one-time sign-in ticket for. Created directly via Clerk Dashboard → Users → Create user (no signup/verification flow — the account is provisioned once, by the admin, ahead of time). `stg`-only.                                                                                                                                                                        | Yes (`stg` only) | Clerk dashboard |
| `AUTH_REDIRECT_PROXY_URL`           | OAuth redirect proxy for local tunnel                                                                                                                                                                                                                                                                                                                                                                                                                       | Local dev only   | `.env.local`    |

> **Note — `stg` authenticates against the same Clerk Production instance as `prd`, not a separate Development instance.** This was a deliberate migration, not an accident: Clerk Development instances rely on a cross-domain "dev browser" JWT passed via querystring (`__clerk_db_jwt`) rather than real first-party cookies, because Development instances aren't bound to a verified custom domain. This mechanism is unreliable for a genuinely new visitor's first request — confirmed directly: the ticket-based `/api/demo` sign-in redirected to Clerk's `*.accounts.dev` Account Portal instead of `/platform` for every fresh browser/device tested, while working inconsistently for browsers that had incidentally already loaded a Clerk-instrumented page on the domain. Clerk Production instances use real `HttpOnly` first-party cookies via a verified CNAME, which doesn't have this failure mode. Clerk explicitly supports one Production instance serving multiple domains — subdomains of a verified primary domain get Frontend API access automatically (hardened further here via Clerk's **Allowed Subdomains** setting, explicitly allowlisting `dev.dw-portfolio.dev` against primary domain `dw-portfolio.dev`) — and Clerk's own session cookies remain strictly scoped per exact domain, so a `stg` recruiter demo session cannot be used to access `prd`. Using the Production instance for `stg` does **not** mean recruiters access the production app — the Vercel project, database, Redis, and `DEMO_MODE` code paths for `stg` remain entirely separate from `prd`; only the underlying Clerk auth infrastructure tier is shared, which is Clerk's own intended pattern for this exact situation.

### Cache & Queues (Upstash)

| Variable                     | Purpose                            | Required        | Source                      |
| ---------------------------- | ---------------------------------- | --------------- | --------------------------- |
| `UPSTASH_REDIS_REST_URL`     | Upstash Redis REST endpoint        | Yes             | Upstash dashboard / Doppler |
| `UPSTASH_REDIS_REST_TOKEN`   | Upstash Redis auth token           | Yes             | Upstash dashboard / Doppler |
| `QSTASH_TOKEN`               | QStash publish auth token          | Yes (AI agents) | Upstash dashboard / Doppler |
| `QSTASH_URL`                 | QStash publish endpoint            | Yes (AI agents) | Upstash dashboard / Doppler |
| `QSTASH_CURRENT_SIGNING_KEY` | Verify incoming QStash requests    | Yes (AI agents) | Upstash dashboard / Doppler |
| `QSTASH_NEXT_SIGNING_KEY`    | Key rotation support               | Yes (AI agents) | Upstash dashboard / Doppler |
| `UPSTASH_API_KEY`            | Upstash Management API (Terraform) | Terraform only  | Upstash dashboard           |
| `UPSTASH_DB_ID`              | Upstash DB ID for Terraform state  | Terraform only  | Upstash dashboard           |

For local dev, Docker runs an Upstash-compatible Redis HTTP proxy on port `8079`. Use:

```
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=<any string matching docker-compose token>
```

### AI / DevOps Platform

| Variable                | Purpose                                                                                                                                                                                                             | Required          | Source                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------- |
| `ANTHROPIC_API_KEY`     | Anthropic Claude API access                                                                                                                                                                                         | Yes (AI agents)   | Anthropic console                               |
| `GITHUB_TOKEN`          | GitHub API — create issues, PR comments, commit files                                                                                                                                                               | Yes (AI agents)   | GitHub PAT                                      |
| `GITHUB_REPO`           | `owner/repo` format (e.g., `user/dw-portfolio-platform`)                                                                                                                                                            | Yes (AI agents)   | Doppler                                         |
| `GITHUB_WEBHOOK_SECRET` | Verify incoming GitHub webhooks                                                                                                                                                                                     | Yes (webhooks)    | GitHub settings                                 |
| `GITHUB_BRANCH`         | Target branch for incident doc commits                                                                                                                                                                              | Optional          | Doppler                                         |
| `SENTRY_WEBHOOK_SECRET` | Verify incoming Sentry webhooks                                                                                                                                                                                     | Yes (webhooks)    | Sentry settings                                 |
| `CRON_SECRET`           | Bearer-token auth for `/api/cron/*` routes — Vercel injects this automatically for its own cron invocations; GitHub Actions-triggered crons (see Cron Jobs below) must have the matching value set as a repo secret | Yes (cron routes) | Vercel (auto) / Doppler / GitHub Actions secret |

### Observability (Sentry + Vercel API)

| Variable                          | Purpose                                                                                           | Required                | Source           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------- | ---------------- |
| `SENTRY_AUTH_TOKEN`               | Source map upload during build                                                                    | Build only              | Sentry settings  |
| `SENTRY_ORG`                      | Sentry organization slug                                                                          | Yes (Sentry sensor)     | Sentry settings  |
| `SENTRY_PROJECT`                  | Sentry project slug                                                                               | Yes (Sentry sensor)     | Sentry settings  |
| `SENTRY_TOKEN`                    | Sentry REST API token (distinct from auth token)                                                  | Yes (Sentry sensor)     | Sentry settings  |
| `NEXT_PUBLIC_SENTRY_DSN`          | Client-side Sentry DSN                                                                            | Yes                     | Sentry settings  |
| `VERCEL_API_TOKEN`                | Fetch deployment history for dashboard                                                            | Yes (Vercel sensor)     | Vercel settings  |
| `VERCEL_PROJECT_ID`               | Vercel project ID                                                                                 | Yes (Vercel sensor)     | Vercel dashboard |
| `VERCEL_TEAM_ID`                  | Vercel team/org ID — scopes API calls that list deployments/projects across the team              | Yes (Vercel sensor)     | Vercel dashboard |
| `VERCEL_DOMAIN`                   | Base domain used by the uptime sensor (`runUptimeChecks`) to derive URLs to check per environment | Yes (health-check cron) | Doppler          |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Bypass protection on preview QStash callbacks                                                     | Preview env             | Vercel dashboard |

> **Note:** Vercel Standard Protection is currently disabled on both `dw-portfolio-platform` and `dw-portfolio-platform-home` Vercel projects (see project history). `VERCEL_AUTOMATION_BYPASS_SECRET` is retained for any automation that still appends it, but is not required for either project while protection stays off.

### Email (Resend)

| Variable                  | Purpose                                                    | Required          | Source           |
| ------------------------- | ---------------------------------------------------------- | ----------------- | ---------------- |
| `RESEND_API_KEY`          | Resend API credentials                                     | Yes (email)       | Resend dashboard |
| `RESEND_FROM_EMAIL`       | Sender for contact form (e.g., `contact@dw-portfolio.dev`) | Yes (email)       | Resend dashboard |
| `RESEND_AGENT_FROM_EMAIL` | Sender for AI agent incident emails                        | Yes (agent email) | Resend dashboard |
| `RESEND_TO_EMAIL`         | Recipient for contact and incident emails                  | Yes (email)       | Doppler          |

### Infrastructure / Terraform

| Variable               | Purpose                               | Required       | Source               |
| ---------------------- | ------------------------------------- | -------------- | -------------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare provider for DNS + R2      | Terraform only | Cloudflare dashboard |
| `CLOUDFLARE_ZONE_ID`   | Cloudflare DNS zone ID                | Terraform only | Cloudflare dashboard |
| `VERCEL_API_TOKEN`     | Vercel provider                       | Terraform only | Vercel settings      |
| `DOPPLER_TOKEN`        | Doppler provider (syncs secrets)      | Terraform only | Doppler dashboard    |
| `R2_ACCESS_KEY_ID`     | Cloudflare R2 Terraform state backend | Terraform only | Cloudflare R2        |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Terraform state backend | Terraform only | Cloudflare R2        |
| `R2_ENDPOINT`          | R2 S3-compatible endpoint URL         | Terraform only | Cloudflare R2        |

---

## Local Development Setup

### Prerequisites

- Node.js `^22.21.0`
- pnpm `^10.19.0`
- Docker Desktop (for Postgres + Redis)
- Doppler CLI (optional but recommended)
- Cloudflared (optional, for tunnel-based OAuth testing)

### Step-by-Step Setup

**1. Clone and install dependencies:**

```bash
git clone <repo-url>
cd dw-portfolio-platform
pnpm install
```

**2. Configure environment variables:**

Option A — Doppler (recommended for team members):

```bash
doppler login
doppler setup   # selects dw-portfolio-platform / dev
doppler run -- pnpm dev
```

Option B — Manual `.env.local`:

```bash
cp .env.example .env.local
# Fill in required values (at minimum: DATABASE_URL, DIRECT_URL, UPSTASH_*)
```

**3. Start Docker infrastructure (Postgres + Redis):**

```bash
pnpm dev:check
# This runs: wait-for-docker.sh && pnpm dev
# Or manually:
pnpm -F @dw/dev-tools dev-tools:infra:up
```

Docker services started:

- Postgres 16 on port `5433`
- Redis 7 on port `6379`
- Upstash-compatible Redis HTTP proxy (`hiett/serverless-redis-http`) on port `8079`

**4. Run database migrations:**

```bash
pnpm dw db migrate.local
```

**5. Seed the database (optional):**

```bash
pnpm dw db seed
```

**6. Start the development server:**

```bash
pnpm dev            # all workspaces
pnpm dev:next       # Next.js only (recommended for web-only work)
pnpm dev:local      # uses local Docker-only env vars
```

**7. Start the Cloudflare tunnel (for OAuth / Clerk in local dev):**

```bash
pnpm dev:tunnel
# Exposes https://tunnel.dw-portfolio.dev → localhost
```

---

## Build and Deployment Pipeline

### CI/CD Overview

```
GitHub PR / push to main or dev
        │
        ▼
GitHub Actions (.github/workflows/ci.yml)
├── lint      → pnpm lint + pnpm lint:ws (sherif workspace linting)
├── format    → pnpm format
├── typecheck → pnpm typecheck
└── tests     → .github/workflows/test.yml
    ├── runtime-test        → pnpm test:runtime (no Docker needed)
    ├── infrastructure-test → Docker + pnpm test:api:infra
    ├── clerk-webhook-test  → Docker + pnpm test:clerk:webhook
    └── astro-unit-test     → pnpm test:astro (no Docker needed)

        │ (all jobs pass)
        ▼
Vercel deploys automatically
├── dev branch  → https://dev.dw-portfolio.dev  (preview, dw-portfolio-platform)
├── dev branch  → https://dev.portfolio.dw-portfolio.dev  (preview, dw-portfolio-platform-home / Astro)
└── main branch → https://dw-portfolio.dev      (production)
```

### Vercel Configuration

- Framework: Next.js (auto-detected) for `dw-portfolio-platform`; Astro (static output) for `dw-portfolio-platform-home`
- Build command: `turbo run build` (with Vercel remote caching via `TURBO_TEAM` + `TURBO_TOKEN`)
- Environment variables: injected from Doppler via the Vercel integration
- Sentry source maps uploaded during build using `SENTRY_AUTH_TOKEN`
- Sentry project dynamically selected: `dw-portfolio-production` for `VERCEL_ENV === "production"`, `dw-portfolio-preview` otherwise
- Vercel Standard Protection (Deployment Protection) is currently **disabled** on both projects — public marketing/demo routes and the recruiter "Try the Demo" flow depend on this; real access control is enforced by Clerk, not by Vercel's edge auth (see `docs/ARCHITECTURE.md` Key Architectural Decisions)

### Turbo Remote Caching

CI and Vercel both use Turborepo remote caching via GitHub Actions secrets:

- `TURBO_TEAM` — organization slug (GitHub Actions variable)
- `TURBO_TOKEN` — Vercel remote cache token (GitHub Actions secret)

### Turbo Task Pipeline Key Points

- `build` depends on `^build` (upstream packages must build first)
- `lint` and `typecheck` depend on `^build` (need compiled upstream packages)
- `dev` and `dev:local` are persistent, never cached
- `db:generate`, `db:migrate`, `db:push`, `db:studio` are all non-cached and interactive

### Cron Jobs

| Route                     | Purpose                                                                                                                                                                            | Trigger (current)                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/cron/docs-agent`    | Nightly documentation-drift scan — structural diff against the repo, Claude-generated changelog bullets appended to affected docs, drift report committed to `docs/drift-reports/` | GitHub Actions `.github/workflows/cron-docs-agent.yml`, nightly 03:00 UTC, **dev branch only**. Its own header comment references a future `vercel.json` cron for production — that file does not exist yet, and production is intentionally not running automated platform-agent jobs at this time (production is recruiter-facing deploy-history only, not live traffic — see `docs/ARCHITECTURE.md`) |
| `/api/cron/health-check`  | Synthetic uptime monitoring — derives URLs to check from `VERCEL_DOMAIN` + `APP_ENV`                                                                                               | Its header comment references a `vercel.json` cron; that file does not exist in this repo yet. Currently **not wired to any scheduler** — reachable only via manual invocation or `/api/platform/health-check/trigger` from the dashboard                                                                                                                                                               |
| `/api/cron/perf-baseline` | Snapshots current P50/P95 response times as the new performance baseline for regression comparison                                                                                 | Not schedule-based despite the `/cron/` path segment — intended to be called from a Vercel deploy hook, or manually from the platform dashboard. No deploy hook is currently configured                                                                                                                                                                                                                 |

All three routes are protected by `CRON_SECRET` via `Authorization: Bearer` header, checked against `config.cron.CRON_SECRET`.

### Platform Dashboard API Routes

All routes below are admin-only (`requireAdmin()`), Node.js runtime, called from `/platform/*` dashboard pages unless noted:

| Route                                  | Method(s) | Purpose                                                                                                                                                                            |
| -------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/platform/incidents/[id]/resolve` | POST      | Manual incident resolution — updates Redis status, closes the linked GitHub issue if one exists                                                                                    |
| `/api/platform/deps`                   | GET       | Lists open Dependabot PRs and security alerts for the Dependencies page                                                                                                            |
| `/api/platform/deps/analyze`           | POST      | Runs the deps-agent breaking-change analysis for a specific major-version Dependabot PR; caches the result                                                                         |
| `/api/platform/deps/merge`             | POST      | Squash-merges one or more Dependabot PRs via the GitHub API                                                                                                                        |
| `/api/platform/advisories/sync`        | POST      | Bidirectional sync between Supabase security advisories and Redis incidents — creates incidents for new advisories, resolves incidents whose advisory no longer exists. Idempotent |
| `/api/platform/docs/trigger`           | POST      | Manually invokes the same docs-agent logic as the nightly cron, for a given branch                                                                                                 |
| `/api/platform/health-check/trigger`   | POST      | Manually invokes the same uptime sensor as the (currently unscheduled) health-check cron                                                                                           |
| `/api/platform/maintenance`            | GET, POST | Reads/sets maintenance mode in Redis; `proxy.ts` middleware shows a maintenance page to non-admin users when enabled                                                               |
| `/api/platform/rollback/preflight`     | GET       | Classifies migration risk for a deployment before rollback is executed                                                                                                             |
| `/api/platform/rollback/execute`       | POST      | Executes a rollback and records the result                                                                                                                                         |
| `/api/platform/search`                 | GET       | Federated search across incidents, deployments, user activity, and static deep-links                                                                                               |

### Webhook Handlers

| Route                  | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Verification                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `/api/webhooks/github` | GitHub (`workflow_run`, `repository_vulnerability_alert`, `issues`)                                                                                                                                                                                                                                                                                                                                                                                                                              | HMAC via `GITHUB_WEBHOOK_SECRET`          |
| `/api/webhooks/sentry` | Sentry (issue alerts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | HMAC via `SENTRY_WEBHOOK_SECRET`          |
| `/api/webhooks/clerk`  | Clerk (user lifecycle events — sync, `RECRUITER_EMAILS` role provisioning). Registered as **two separate endpoints** in the same Clerk Production instance — one for `https://dw-portfolio.dev` (`prd`), one for `https://dev.dw-portfolio.dev` (`stg`) — each with its own `CLERK_WEBHOOK_SECRET`. The handler itself (`handler.ts`) has no awareness of which endpoint sent an event; it only verifies the signature against whichever secret is present in that deployment's own environment. | Svix signature via `CLERK_WEBHOOK_SECRET` |

### Other Notable Routes

- **`/api/trpc/[trpc]`** — the tRPC handler mounting all routers from `packages/api` (auth, post, contact). Requires Node.js runtime per the `runtimeDb()`/`runtimeRedis()` singleton guards.
- **`/api/test-sentry-error`** — a manual Sentry integration smoke-test route (`GET`, captures a synthetic exception with a unique fingerprint). Its own source comment reads `// DELETE THIS FILE AFTER TESTING`. **Open decision, not yet made**: delete it now that Sentry integration is confirmed working, or keep it intentionally (e.g., as a demo-trigger for the AI incident pipeline) and remove the stale comment. Until resolved, the docs-agent will keep flagging it as drift on every run.

---

## Database Management

### Running Migrations

**Against the remote database (preview or production):**

```bash
pnpm dw db migrate
# Uses DATABASE_URL from environment / Doppler
```

**Against local Docker database:**

```bash
pnpm dw db migrate.local
# Uses .env.local with DATABASE_URL pointing to localhost:5433
```

**Generating migration files after schema changes:**

```bash
pnpm dw db generate
# Reads: packages/db/src/schema.ts + packages/db/src/auth-schema.ts
# Outputs: packages/db/drizzle/
```

**Push schema directly (no migration file — development only):**

```bash
pnpm dw db push.local
```

**Open Drizzle Studio (visual DB browser):**

```bash
pnpm dw db studio.local   # local Docker
pnpm dw db studio          # remote DB
```

### Test Database Setup

Integration tests require a real Postgres database. The test setup script creates and migrates the test DB:

```bash
pnpm -F @dw/dev-tools dev-tools:db:test-setup
```

This is called automatically in CI by the `api:infrastructure:test` Turbo task dependency.

### Connecting to Production Database

The production database uses Supabase's PgBouncer transaction pooler on `DATABASE_URL`. For direct queries (e.g., running `psql`), use `DIRECT_URL` (the direct Supabase connection string). The ORM client sets `prepare: false` to be compatible with PgBouncer.

> Never run `db push` or `db push:local` against production. Always use `db migrate` with reviewed migration files.

---

## Monitoring and Alerting

### Sentry

- Server errors are captured in `sentry.server.config.ts` via `register()` in `src/instrumentation.ts`
- Edge errors are captured in `sentry.edge.config.ts`
- Client errors are captured in `src/instrumentation-client.ts`
- The `onRequestError` hook (`Sentry.captureRequestError`) is exported from `instrumentation.ts` for automatic request error capture

**Accessing Sentry:**

- Preview errors: Sentry project `dw-portfolio-preview`
- Production errors: Sentry project `dw-portfolio-production`
- Organization: `imperial-coal`

### Platform Dashboard

The admin dashboard at `/platform` (requires Clerk admin auth) shows:

- `/platform` — System health overview, recent incidents, deploy status
- `/platform/incidents` — Full incident list with status, severity, resolution
- `/platform/deployments` — Vercel deployment history
- `/platform/insights` — Platform insights
- `/platform/dependencies` — Dependabot PRs and security alerts, with merge/analyze actions
- `/platform/users` — Clerk user activity and provisioning status
- `/platform/database` — Supabase health metrics and advisories
- `/platform/vercel` — Vercel deployment/project detail
- `/platform/infrastructure` — Terraform-managed infrastructure overview
- `/platform/communications` — Resend email activity (contact form + incident alerts)
- `/platform/observability` — Sentry error/observability summary

See **Platform Dashboard API Routes** above for the full set of endpoints backing these pages.

### Log Format

All AI agents and processors emit structured JSON logs. Example:

```json
{
  "level": "info",
  "agent": "ci",
  "event": "complete",
  "runId": "12345",
  "commitSha": "abc1234",
  "issueUrl": "https://github.com/...",
  "incidentDocPath": "docs/incidents/2026-03-19-..."
}
```

Logs are visible in Vercel Functions logs for each serverless invocation.

### Incident Lifecycle

```
1. Webhook received → QStash job enqueued
2. Agent runs       → status: "investigating"
3. Agent completes  → status: "open"
4. GitHub issue closed OR Sentry resolved OR security alert dismissed → status: "resolved"
5. Manual override  → POST /api/platform/incidents/:id/resolve (admin only)
```

`IncidentRecord.githubIssueError` (added when GitHub issue creation is attempted but fails — e.g. transient rate limiting) is surfaced in the dashboard as a distinct "⚠ GitHub issue creation failed" badge, separate from incident types that never attempt issue creation at all.

---

## Secrets Management

All secrets are stored in **Doppler** under project `dw-portfolio-platform`.

| Config | Used for                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`  | Local development (pulled via `doppler run --`)                                                                                                   |
| `stg`  | Vercel preview deployments (`dev` branch), auto-synced. Hosts `DEMO_MODE`/`RECRUITER_EMAILS`/`DEMO_USER_CLERK_ID` and the recruiter demo overlay. |
| `prd`  | Vercel production deployments (`main` branch), auto-synced. `DEMO_MODE=false` — deploy-history-only, no live/demo traffic.                        |

**Rotating a secret:**

1. Generate the new secret in the relevant service dashboard
2. Update the value in Doppler under the appropriate config
3. Vercel will pick up the new value on the next deployment (or trigger a redeploy)
4. For GitHub Actions secrets, update in the repository Settings → Secrets

**Terraform provider credentials** are stored separately in Doppler or a local `.env` file used only during `pnpm dw infra` commands. They are never committed to the repository.

---

## Scaling Considerations

- **Supabase free tier**: The DB client sets `max: 3` connections in production (`max: 5` in local dev) to stay within Supabase's free tier connection limits. If upgrading to a paid tier, increase `max` in `packages/db/src/client.ts`.

- **Redis incident storage**: The incident index is capped at 100 entries (`MAX_INCIDENTS = 100`) with a 30-day TTL. Individual incidents expire after 30 days. This is sufficient for the portfolio's traffic volume. If volume increases, consider archiving resolved incidents to Postgres instead.

- **QStash throughput**: Each CI failure, Sentry error, and security alert enqueues one job. At portfolio scale this is negligible. QStash free tier supports 500 requests/day — monitor in the Upstash dashboard if webhook volume grows.

- **Anthropic API costs**: All agents use `claude-sonnet-5` with a `max_tokens: 1024` cap. (Previous pin `claude-sonnet-4-20250514` reached end-of-life 2026-06-15 and silently broke the entire incident pipeline until caught via the demo trigger panel — worth periodically checking Anthropic's deprecation schedule rather than only via a live failure.) Each incident analysis consumes approximately 2-5K tokens total. Add up-front cost tracking if incident volume grows significantly.

- **Edge vs. Node runtime routing**: All stateless webhook receivers and tRPC handlers that don't touch Postgres can move to Edge for better cold start times. The runtime guard in `platform/runtime` will throw immediately if the wrong runtime is used, so the boundary is enforced at development time rather than production.


---

---

---

---

## Documentation Drift — 2026-07-16

> Auto-detected by platform-agent · Review and update the sections above · Remove this block when resolved

- **New cron routes added** (`/api/cron/docs-agent`, `/api/cron/health-check`, `/api/cron/perf-baseline`): add a new "Scheduled Jobs / Cron" section (or extend Infrastructure Overview) documenting each route's schedule, purpose, and required `CRON_SECRET` auth header.

- **New demo trigger endpoints** (`/api/demo/trigger/ci`, `/api/demo/trigger/sentry`): document under a new "Demo/Test Endpoints" subsection describing what each trigger simulates and any auth requirements.

- **New platform dependency management routes** (`/api/platform/deps`, `/api/platform/deps/analyze`, `/api/platform/deps/merge`): add to Infrastructure Overview / new "Platform API" section describing dependency scan, analysis, and merge workflow.

- **New platform advisories sync route** (`/api/platform/advisories/sync`): document trigger mechanism (manual or scheduled) and expected response in the Platform API section.

- **New platform docs trigger route** (`/api/platform/docs/trigger`): document how it invokes the docs-agent pipeline and any payload/auth requirements.

- **New platform health-check trigger route** (`/api/platform/health-check/trigger`): document as manual invocation counterpart to the `/api/cron/health-check` scheduled job.

- **New incident resolution route** (`/api/platform/incidents/[id]/resolve`): add to Platform API section describing incident ID param, resolution payload, and side effects.

- **New maintenance mode route** (`/api/platform/maintenance`): document how to toggle maintenance mode and its effect on traffic/routing.

- **New rollback routes** (`/api/platform/rollback/preflight`, `/api/platform/rollback/execute`): document the two-step rollback flow (preflight check then execute) including required params and safety checks.

- **New platform search route** (`/api/platform/search`): document query params and scope of searchable data.

- **New Sentry test error route** (`/api/test-sentry-error`): document as a diagnostic endpoint for verifying Sentry error reporting integration.

- **New webhook handlers** (`/api/webhooks/github
