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

| Variable                            | Purpose                               | Required       | Source          |
| ----------------------------------- | ------------------------------------- | -------------- | --------------- |
| `CLERK_SECRET_KEY`                  | Server-side Clerk API key             | Yes (auth)     | Clerk dashboard |
| `CLERK_WEBHOOK_SECRET`              | Verifies incoming Clerk webhooks      | Yes (auth)     | Clerk dashboard |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client-side Clerk key                 | Yes (auth)     | Clerk dashboard |
| `AUTH_REDIRECT_PROXY_URL`           | OAuth redirect proxy for local tunnel | Local dev only | `.env.local`    |

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

| Variable                | Purpose                                                  | Required        | Source            |
| ----------------------- | -------------------------------------------------------- | --------------- | ----------------- |
| `ANTHROPIC_API_KEY`     | Anthropic Claude API access                              | Yes (AI agents) | Anthropic console |
| `GITHUB_TOKEN`          | GitHub API — create issues, PR comments, commit files    | Yes (AI agents) | GitHub PAT        |
| `GITHUB_REPO`           | `owner/repo` format (e.g., `user/dw-portfolio-platform`) | Yes (AI agents) | Doppler           |
| `GITHUB_WEBHOOK_SECRET` | Verify incoming GitHub webhooks                          | Yes (webhooks)  | GitHub settings   |
| `GITHUB_BRANCH`         | Target branch for incident doc commits                   | Optional        | Doppler           |
| `SENTRY_WEBHOOK_SECRET` | Verify incoming Sentry webhooks                          | Yes (webhooks)  | Sentry settings   |

### Observability (Sentry + Vercel API)

| Variable                          | Purpose                                          | Required            | Source           |
| --------------------------------- | ------------------------------------------------ | ------------------- | ---------------- |
| `SENTRY_AUTH_TOKEN`               | Source map upload during build                   | Build only          | Sentry settings  |
| `SENTRY_ORG`                      | Sentry organization slug                         | Yes (Sentry sensor) | Sentry settings  |
| `SENTRY_PROJECT`                  | Sentry project slug                              | Yes (Sentry sensor) | Sentry settings  |
| `SENTRY_TOKEN`                    | Sentry REST API token (distinct from auth token) | Yes (Sentry sensor) | Sentry settings  |
| `NEXT_PUBLIC_SENTRY_DSN`          | Client-side Sentry DSN                           | Yes                 | Sentry settings  |
| `VERCEL_API_TOKEN`                | Fetch deployment history for dashboard           | Yes (Vercel sensor) | Vercel settings  |
| `VERCEL_PROJECT_ID`               | Vercel project ID                                | Yes (Vercel sensor) | Vercel dashboard |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Bypass protection on preview QStash callbacks    | Preview env         | Vercel dashboard |

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
    ├── runtime-test       → pnpm test:runtime (no Docker needed)
    ├── infrastructure-test → Docker + pnpm test:api:infra
    └── clerk-webhook-test  → Docker + pnpm test:clerk:webhook

        │ (all jobs pass)
        ▼
Vercel deploys automatically
├── dev branch  → https://dev.dw-portfolio.dev  (preview)
└── main branch → https://dw-portfolio.dev      (production)
```

### Vercel Configuration

- Framework: Next.js (auto-detected)
- Build command: `turbo run build` (with Vercel remote caching via `TURBO_TEAM` + `TURBO_TOKEN`)
- Environment variables: injected from Doppler via the Vercel integration
- Sentry source maps uploaded during build using `SENTRY_AUTH_TOKEN`
- Sentry project dynamically selected: `dw-portfolio-production` for `VERCEL_ENV === "production"`, `dw-portfolio-preview` otherwise

### Turbo Remote Caching

CI and Vercel both use Turborepo remote caching via GitHub Actions secrets:

- `TURBO_TEAM` — organization slug (GitHub Actions variable)
- `TURBO_TOKEN` — Vercel remote cache token (GitHub Actions secret)

### Turbo Task Pipeline Key Points

- `build` depends on `^build` (upstream packages must build first)
- `lint` and `typecheck` depend on `^build` (need compiled upstream packages)
- `dev` and `dev:local` are persistent, never cached
- `db:generate`, `db:migrate`, `db:push`, `db:studio` are all non-cached and interactive

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

---

## Secrets Management

All secrets are stored in **Doppler** under project `dw-portfolio-platform`.

| Config       | Used for                                        |
| ------------ | ----------------------------------------------- |
| `dev`        | Local development (pulled via `doppler run --`) |
| `preview`    | Vercel preview deployments (auto-synced)        |
| `production` | Vercel production deployments (auto-synced)     |

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

- **Anthropic API costs**: All agents use `claude-sonnet-4-20250514` with a `max_tokens: 1024` cap. Each incident analysis consumes approximately 2–5K tokens total. Add up-front cost tracking if incident volume grows significantly.

- **Edge vs. Node runtime routing**: All stateless webhook receivers and tRPC handlers that don't touch Postgres can move to Edge for better cold start times. The runtime guard in `platform/runtime` will throw immediately if the wrong runtime is used, so the boundary is enforced at development time rather than production.


---

---

## Documentation Drift — 2026-04-02

> Auto-detected by platform-agent · Review and update the sections above · Remove this block when resolved

• Added cron job `/api/cron/docs-agent` → Update **## Infrastructure Overview** → Add docs-agent automated documentation cron job description
• Added platform dependency analysis endpoint `/api/platform/deps/analyze` → Update **## Infrastructure Overview** → Document dependency analysis API functionality
• Added platform dependency merge endpoint `/api/platform/deps/merge` → Update **## Infrastructure Overview** → Document dependency merge API functionality
• Added platform dependencies list endpoint `/api/platform/deps` → Update **## Infrastructure Overview** → Document dependencies management API
• Added platform docs trigger endpoint `/api/platform/docs/trigger` → Update **## Infrastructure Overview** → Document manual documentation generation trigger
• Added incident resolution endpoint `/api/platform/incidents/[id]/resolve` → Update **## Infrastructure Overview** → Document incident management API for resolving incidents
• Added rollback execution endpoint `/api/platform/rollback/execute` → Update **## Infrastructure Overview** → Document platform rollback execution API
• Added rollback preflight endpoint `/api/platform/rollback/preflight` → Update **## Infrastructure Overview** → Document rollback preflight checks API
• Added tRPC API handler `/api/trpc/[trpc]` → Update **## Infrastructure Overview** → Document tRPC integration endpoint
• Added Clerk webhook handler `/api/webhooks/clerk` → Update **## Infrastructure Overview** → Document Clerk authentication webhook processing
• Added GitHub webhook handler `/api/webhooks/github` → Update **## Infrastructure Overview** → Document GitHub integration webhook
• Added Sentry webhook handler `/api/webhooks/sentry` → Update **## Infrastructure Overview** → Document Sentry error reporting webhook
• New environment variable `CRON_SECRET` → Update **### Infrastructure / Terraform** → Add CRON_SECRET for securing cron job endpoints
• New environment variable `VERCEL_TEAM_ID` → Update **### Observability (Sentry + Vercel API)** → Add VERCEL_TEAM_ID for Vercel API team identification
