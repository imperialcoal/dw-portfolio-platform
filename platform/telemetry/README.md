# platform/telemetry

Placeholder directory for future observability and telemetry tooling.

Currently empty. Sentry integration is handled directly in `apps/nextjs` via `@sentry/nextjs`. This directory is reserved for centralized telemetry configuration if observability needs grow — for example:
- OpenTelemetry collector configuration
- Shared Sentry configuration package (to avoid duplication if a second app is added)
- Custom metrics collection (e.g., Datadog, Prometheus exporters)
- Log aggregation configuration

Current observability stack:
- Error tracking: Sentry (`apps/nextjs/sentry.*.config.ts`)
- Structured logs: JSON to Vercel Functions stdout (parsed by Vercel log drains)
- Platform health: `/platform` dashboard via AI agent Redis memory
