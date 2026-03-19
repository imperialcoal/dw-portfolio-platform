# platform/

Platform-level infrastructure, tooling, and runtime packages. Unlike `packages/`, which contains shared libraries for product features, `platform/` contains the operational backbone of the monorepo.

| Directory | Package | Description |
|---|---|---|
| `ai/` | `@dw/ai` | AI agent system: sensors, analyzers (CI/Sentry/Security agents), actions, Redis memory |
| `cli/` | `@dw/cli` | `pnpm dw` CLI: domain-routed commands for db and infra operations |
| `dev-tools/` | `@dw/dev-tools` | Docker Compose local infra, DB seed/setup scripts |
| `infra/` | — | Terraform IaC: Vercel, Cloudflare, Supabase, Upstash, Doppler |
| `pipelines/` | — | Placeholder for future CI/CD pipeline definitions |
| `runtime/` | `@dw/runtime` | Runtime detection, capability guards, singleton context factories |
| `standards/` | Various | Shared ESLint, TypeScript, Tailwind, Prettier, GitHub Action configs |
| `telemetry/` | — | Placeholder for future observability tooling |
| `testing/` | `@dw/testing` | Shared Vitest configuration, test environment guards |

See each subdirectory's README for detailed documentation.
