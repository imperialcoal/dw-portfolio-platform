# Demo Module

Recruiter-facing overlay for the portfolio platform. Activates via a single
Doppler variable and can be removed completely without touching the core
codebase. All demo concerns are self-contained in this directory.

---

## Activating demo mode

In Doppler `stg` (preview environment), set:

```
DEMO_MODE=true
RECRUITER_EMAILS=recruiter@example.com
```

The preview domain (`dev.dw-portfolio.dev`) will show the full recruiter
landing page. The base portfolio home remains the default for any environment
where `DEMO_MODE` is not set to `"true"`.

---

## What demo mode does

| Concern                | Behavior                                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| Home page              | Renders `DemoHomePage` instead of `HomeContent`                             |
| Metadata               | SEO title and OG tags swapped to recruiter-facing copy                      |
| `/admin` guard         | Allows recruiter role via `requireRecruiterOrAdmin()`                       |
| `/platform` guard      | Allows recruiter role; shows `DemoBanner` for recruiter sessions            |
| Platform deep links    | Disabled with tooltips for recruiter sessions via `DemoDeepLink`            |
| Demo controls          | `DemoIncidentTrigger` shown on platform overview for recruiter sessions     |
| Recruiter provisioning | Emails in `RECRUITER_EMAILS` auto-provisioned as `recruiter` role on signup |

Everything else — the tRPC API, incident pipeline, AI agents, rollback,
webhooks — is unchanged. Demo mode only affects access control and UI surface.

---

## Access control

Two functions determine demo behavior for a given request:

### `isDemoMode()`

Synchronous. Reads `DEMO_MODE` env var at build time. Returns `true` when
the environment is configured for demo. No auth context required.

**Use for:** unauthenticated routes, pre-auth guards, webhook handlers, the
home page. Anything that runs before a session is resolved.

### `isDemoSession()`

Async. Returns `true` only when `DEMO_MODE=true` AND the current session role
is `recruiter`. Admins always get `false` — they retain full access to all
deep links and platform functionality regardless of the Doppler flag.

**Use for:** authenticated server components that control UI/links — the
seven platform subpages and the platform overview.

---

## File map

```
src/demo/
├── index.ts                          # Single export point — import everything from here
├── is-demo-mode.ts                   # isDemoMode() — reads DEMO_MODE env var
├── demo-metadata.ts                  # generateDemoMetadata() — recruiter OG/title metadata
├── demo-deep-links.ts                # DEMO_TOOLTIPS — centralized tooltip copy catalog
├── DemoHomePage.tsx                  # Full recruiter landing page component
├── DemoBanner.tsx                    # "Recruiter demo session" persistent banner
├── DemoDeepLink.tsx                  # Demo-aware anchor/disabled-button wrapper
├── auth/
│   ├── require-recruiter-or-admin.ts # getPlatformAccessLevel() — platform access guard
│   ├── recruiter-emails.ts           # getRecruiterEmails() — reads RECRUITER_EMAILS
│   └── is-demo-session.ts            # isDemoSession() — role-aware demo check
├── triggers/
│   ├── DemoIncidentTrigger.tsx       # UI component — fires CI/Sentry via fetch
│   ├── ci-payload.ts                 # buildSyntheticCiPayload()
│   ├── sentry-payload.ts             # buildSyntheticSentryPayload()
│   └── index.ts                      # Re-exports
└── README.md                         # This file
```

---

## Deep links (`DemoDeepLink` + `DEMO_TOOLTIPS`)

All external links to private service consoles (Supabase, Vercel, Upstash,
Sentry, GitHub, Clerk, Resend, Doppler) are wrapped in `DemoDeepLink`.

When `isDemo=false` — renders a plain `<a>` tag. Zero overhead.
When `isDemo=true` — renders a visually disabled button with a tooltip
explaining what the service does and why admin credentials are required.

```tsx
import { DEMO_TOOLTIPS, DemoDeepLink, isDemoSession } from "~/demo";

// In an async server component:
const isDemo = await isDemoSession();

<DemoDeepLink
  href="https://console.upstash.com/redis"
  label="Upstash Redis →"
  tooltip={DEMO_TOOLTIPS.upstashRedis}
  isDemo={isDemo}
  className="..."
/>;
```

All tooltip strings live in `demo-deep-links.ts` — edit there, reflects
everywhere. Covers: Upstash, Vercel, Sentry, GitHub, Clerk, Resend, Doppler,
Supabase.

---

## Recruiter provisioning (`getRecruiterEmails`)

Emails in the `RECRUITER_EMAILS` Doppler variable are auto-provisioned as
`recruiter` role when they sign up via the Clerk webhook. No SQL required.

The webhook handler (`apps/nextjs/src/app/api/webhooks/clerk/route.ts`) reads
`RECRUITER_EMAILS` via `getRecruiterEmails()` and injects them into the
handler as `recruiterEmails`. The handler itself has no knowledge of demo
mode — it accepts `recruiterEmails` as a generic optional injection.

To add a recruiter:

1. Add their email to `RECRUITER_EMAILS` in Doppler `stg` (comma-separated)
2. Redeploy the preview environment
3. They sign up → auto-provisioned as `recruiter` → Clerk metadata synced
4. They have full platform access with demo banner

---

## Call sites outside `src/demo/`

These files import from the demo module and require updates when demo mode
is removed:

| File                                       | What to change                                            |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/app/page.tsx`                         | Remove `isDemoMode()` conditional, remove metadata export |
| `src/app/(admin)/admin/page.tsx`           | Revert to `requireAdmin()` only                           |
| `src/app/(admin)/platform/layout.tsx`      | Remove `DemoBanner`, revert to `requireAdmin()`           |
| `src/app/(admin)/platform/page.tsx`        | Remove `isDemoSession()` + `DemoIncidentTrigger`          |
| `src/app/(admin)/platform/*/page.tsx`      | Replace `DemoDeepLink` with plain `<a>` tags              |
| `src/app/api/webhooks/clerk/route.ts`      | Remove `isDemoMode()` + `getRecruiterEmails()`            |
| `src/app/api/demo/trigger/ci/route.ts`     | Delete file                                               |
| `src/app/api/demo/trigger/sentry/route.ts` | Delete file                                               |

---

## Removing demo mode (when portfolio is live)

1. Set `DEMO_MODE=false` in Doppler (or delete the variable)
2. Remove `RECRUITER_EMAILS` from Doppler
3. Delete `src/demo/` entirely
4. Delete `src/app/api/demo/`
5. Apply changes in the call sites table above
6. Done — the core codebase is clean, no traces remain
