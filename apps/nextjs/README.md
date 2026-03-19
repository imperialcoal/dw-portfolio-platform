# @dw/nextjs

The primary web application for the portfolio platform. Built with Next.js 15 App Router, it serves two distinct concerns under one deployment: a public-facing portfolio website and an authenticated admin platform dashboard for AI-powered DevOps monitoring.

## Purpose

- Public portfolio website with contact form and content
- Admin platform dashboard (`/platform`) for viewing incidents, deployments, and system health
- API layer: tRPC endpoint, GitHub/Sentry/Clerk webhook receivers, QStash job processors, and manual incident resolution endpoint

## Architecture

```
src/
├── app/
│   ├── (admin)/platform/          # Admin-only platform dashboard (Clerk auth gated)
│   │   ├── incidents/             # Incident list with manual resolve buttons
│   │   ├── deployments/           # Vercel deployment history
│   │   ├── insights/              # Platform insights
│   │   └── page.tsx               # Platform overview
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── github/route.ts    # Edge: receives workflow_run, issues, vulnerability_alert
│   │   │   ├── sentry/route.ts    # Edge: receives Sentry issue events
│   │   │   └── clerk/route.ts     # Edge: receives Clerk user sync events
│   │   ├── process/
│   │   │   ├── ci/route.ts        # Node: QStash consumer → runs CI agent
│   │   │   ├── sentry/route.ts    # Node: QStash consumer → runs Sentry agent
│   │   │   ├── security/route.ts  # Node: QStash consumer → runs Security agent
│   │   │   └── resolve/route.ts   # Node: QStash consumer → resolves incidents
│   │   ├── platform/incidents/
│   │   │   └── [id]/resolve/      # Node: Admin-only manual resolution endpoint
│   │   └── trpc/[trpc]/route.ts   # tRPC request handler
│   └── _components/               # Public page components
├── auth/                          # Next.js-specific auth helpers (requireAdmin, withAuthority)
├── lib/supabase/                  # Supabase admin client + storage helpers
└── trpc/                          # tRPC client (React + server-side RSC callers)
```

### Runtime Boundaries

| Route | Runtime | Reason |
|---|---|---|
| `/api/webhooks/*` | Edge | Fast response; only HMAC verification + QStash publish |
| `/api/process/*` | Node.js, `maxDuration: 300` | LLM calls, Postgres, Redis require TCP sockets |
| `/api/platform/incidents/*/resolve` | Node.js | Requires Redis write access |
| `/api/trpc/*` | Node.js | Postgres queries via Drizzle |

## Tech Stack

- Next.js 15 (App Router)
- Clerk (authentication middleware)
- tRPC 11 (type-safe API)
- Drizzle ORM (via `@dw/db`)
- Sentry (`@sentry/nextjs`, instrumentation hooks)
- Tailwind CSS 4
- Upstash Redis + QStash (via `@dw/redis`, `@dw/qstash`)

## Key Exports / API Surface

The app does not export a library API. The following internal modules are notable entry points:

- `src/auth/require-admin.ts` — throws `403` if the caller is not a Clerk-authenticated admin. Used in the manual resolve endpoint.
- `src/auth/with-authority.ts` — middleware helper that resolves the full `AuthorityContext` from a Clerk session.
- `src/trpc/server.tsx` — creates a server-side tRPC caller for use in React Server Components (no HTTP round-trip).
- `src/trpc/react.tsx` — exports the `TRPCReactProvider` and `trpc` client for client components.

## Configuration

- `next.config.js` — imports all `@dw/validators/*` env schemas at build time via jiti; wraps config with `withSentryConfig`
- `src/env.ts` — defines `NEXT_PUBLIC_*` env vars validated client-side
- Sentry project selection is dynamic: `dw-portfolio-production` when `VERCEL_ENV === "production"`, `dw-portfolio-preview` otherwise

## Dependencies

Consumes: `@dw/api`, `@dw/ai`, `@dw/auth`, `@dw/config`, `@dw/contracts`, `@dw/db`, `@dw/llm`, `@dw/qstash`, `@dw/redis`, `@dw/ui`, `@dw/validators`

No other monorepo packages depend on this app.

## Local Development

```bash
# Start Next.js only (most common for web work)
pnpm dev:next

# With Docker infrastructure (Postgres + Redis)
pnpm dev:next:check

# With local env vars only (no cloud services)
pnpm dev:next:local

# With Cloudflare tunnel (needed for Clerk OAuth callbacks)
pnpm dev:tunnel
# in another terminal:
pnpm dev:next
```

The dev server runs on `http://localhost:3000`. The Cloudflare tunnel exposes `https://tunnel.dw-portfolio.dev → localhost:3000`.

## Developer Notes

> **Developer Note**
> The `(admin)` route group uses Next.js route group syntax — it does NOT add `/admin` to the URL. Routes inside `(admin)/platform/` are accessible at `/platform/*`. The parentheses group only applies layout nesting for the shared platform layout.

> **Developer Note**
> The `VERCEL_AUTOMATION_BYPASS_SECRET` is appended as a query parameter to QStash processor URLs in non-production environments (see `packages/qstash/src/publish.ts`). This bypasses Vercel's deployment protection on preview URLs, allowing QStash (an external service) to POST to the processor endpoints that would otherwise be gated by Vercel's password protection.
