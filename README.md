# Platform Intelligence

A production-grade AI DevOps platform built as a portfolio project. Live at [dev.dw-portfolio.dev](https://dev.dw-portfolio.dev).

---

## What this is

An internal platform dashboard with a fully automated incident pipeline. GitHub CI failures, Sentry errors, and Dependabot security alerts are automatically classified and analyzed by an Anthropic-powered agent — no manual triage.

This is not a template or tutorial project. It runs on real infrastructure, handles real events, and the code reflects production engineering decisions throughout.

---

## Live demo

Platform dashboard: [dev.dw-portfolio.dev/platform](https://dev.dw-portfolio.dev/platform)

| Credential | Value                   |
| ---------- | ----------------------- |
| Email      | `demo@dw-portfolio.dev` |
| Password   | `ViewerDemo2026!`       |

The demo account has `viewer` role — full read access, no destructive actions.

---

## Architecture

```
dw-portfolio-platform/
├── apps/
│   └── nextjs/          # Next.js 16 app (App Router)
├── packages/
│   ├── api/             # tRPC router + procedures
│   ├── auth/            # Clerk RBAC (admin / viewer / user)
│   ├── contracts/       # Shared TypeScript types for AI events
│   ├── db/              # Drizzle ORM + Supabase PG16 schema
│   ├── llm/             # Anthropic SDK + prompt library
│   ├── redis/           # Upstash client + cache key registry
│   ├── ui/              # shadcn/ui components + theme system
│   └── validators/      # Zod schemas + t3-env config
└── platform/
    ├── ai/              # AI agent: analyzers, sensors, memory
    ├── cli/             # pnpm dw developer CLI
    ├── infra/           # Terraform (6 providers, 2 environments)
    ├── runtime/         # Boot guards + environment detection
    └── standards/       # ESLint, TypeScript, Prettier configs
```

---

## Incident Pipeline

```
GitHub webhook (CI failure / security alert)
  └─→ /api/webhooks/github
        └─→ QStash (deduplication by run ID)
              └─→ /api/process/ci
                    └─→ platform/ai/src/analyzers/ci-agent.ts
                          └─→ Anthropic Claude (root cause analysis)
                                └─→ Redis incident record
                                      └─→ Platform dashboard
```

The same pipeline handles Sentry errors and Dependabot alerts. All events are deduplicated, environment-gated, and stored with structured metadata: severity, affected service, branch, commit SHA, AI-generated root cause, and resolution notes.

---

## Infrastructure

Two fully independent environments managed by Terraform:

| Resource | Preview              | Production           |
| -------- | -------------------- | -------------------- |
| Supabase | akbwxhwpvpwvbpevowmr | ykmjoyxpcvalqqzahmuc |
| Domain   | dev.dw-portfolio.dev | dw-portfolio.dev     |
| Doppler  | stg                  | prd                  |

State stored in Cloudflare R2. Six Terraform providers: Cloudflare, Vercel, Supabase, Upstash, Doppler.

```bash
APP_ENV=preview pnpm dw infra tf.init
APP_ENV=preview pnpm dw infra tf.plan
APP_ENV=preview pnpm dw infra tf.apply
```

---

## Tech Stack

**Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, tRPC 11
**Backend**: Drizzle ORM, Supabase PostgreSQL 16, Upstash Redis, QStash
**Auth**: Clerk v7 (RBAC: admin / viewer / user roles)
**AI**: Anthropic Claude 3.5 Sonnet via SDK
**Infra**: Terraform, Vercel, Cloudflare, Doppler, Sentry, Resend
**Tooling**: Turborepo, pnpm workspaces, Vitest, GitHub Actions CI

---

## Running locally

```bash
pnpm install
pnpm dw infra up          # Start Docker (Postgres + Redis)
pnpm dw db migrate.local  # Apply migrations
pnpm dev:next:local       # Start dev server
```

---

## Key engineering decisions

**Why QStash instead of direct processing?** Webhook handlers must return 200 within 10 seconds or Vercel kills the function. AI analysis takes 5-15 seconds. QStash decouples receipt from processing and adds automatic retry with exponential backoff.

**Why service_role RLS instead of JWT-based row policies?** All DB writes go through Drizzle ORM via PgBouncer's transaction pooler. PgBouncer does not forward JWTs, so auth.uid() is always NULL. The correct model is service-level policies.

**Why Doppler + Terraform instead of Vercel env vars?** Doppler is the single source of truth. Terraform reads from Doppler and syncs to Vercel. No secrets in version control, no manual configuration.

**Why a custom CLI?** A filesystem-based router discovers commands by convention. Adding a command is creating a file — no registration, no config.
