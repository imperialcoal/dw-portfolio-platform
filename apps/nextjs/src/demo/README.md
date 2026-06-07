# Demo Module

Recruiter-facing overlay for the portfolio platform. Activates via a single Doppler variable and can be removed completely without touching the core codebase.

## Activating demo mode

In Doppler `stg` (preview environment), set:

```
DEMO_MODE=true
```

The preview domain (`dev.dw-portfolio.dev`) will show the full recruiter landing page. The base portfolio home remains the default for any environment where `DEMO_MODE` is not set to `"true"`.

## What demo mode does

When active, `src/app/page.tsx` renders `DemoHomePage` instead of `HomeContent`. The metadata is also swapped to recruiter-optimized titles and OG tags via `generateDemoMetadata`.

Everything else — `/admin`, `/platform`, the tRPC API, auth — is unchanged. Demo mode only affects the home route.

## File map

```
src/demo/
├── index.ts           # Single export point — import everything from here
├── is-demo-mode.ts    # isDemoMode() — reads DEMO_MODE env var
├── demo-metadata.ts   # generateDemoMetadata() — recruiter OG/title metadata
├── DemoHomePage.tsx   # Full recruiter landing page component
└── README.md          # This file
```

## Removing demo mode (when portfolio is live)

1. Set `DEMO_MODE=false` in Doppler, or delete the variable entirely
2. Delete `src/demo/`
3. In `src/app/page.tsx`, remove the `isDemoMode` conditional and revert to:
   ```tsx
   export default function HomePage() {
     return <HomeContent />;
   }
   ```
4. Remove the `generateDemoMetadata` export line from `page.tsx`
5. Done — the core codebase is clean

## Adding demo interactions (future)

The `src/demo/` directory is the right place for any demo-specific tRPC procedures, UI components, or synthetic event triggers. Future additions:

- `DemoIncidentTrigger.tsx` — fires a synthetic incident through the real QStash pipeline
- `DemoDeploymentTrigger.tsx` — creates a synthetic deployment record
- `demo.router.ts` — tRPC procedures for the above (added to appRouter behind adminProcedure)

These belong here, not in the core platform routes, so they can be removed with one directory delete.
