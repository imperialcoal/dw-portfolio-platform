# packages/

Shared library packages consumed by apps and platform modules. All packages use the `@dw/` namespace.

| Package | Description |
|---|---|
| `api/` | tRPC router definitions (auth, post, contact procedures) |
| `auth/` | Clerk integration, RBAC guards, user provisioning logic |
| `config/` | Unified `config` object composed from all env validators |
| `contracts/` | Shared TypeScript types: `PlatformEvent`, `IncidentRecord`, QStash payloads, event bus |
| `db/` | Drizzle ORM client, schema (`user`, `post`), migration files |
| `env/` | Re-exports for environment variable access patterns |
| `health/` | Infrastructure health check primitives (DB ping, Redis ping) |
| `llm/` | Anthropic SDK client, `analyzeEvent()`, XML response parser, prompt builders |
| `messaging/` | Resend email client: contact form + incident alert emails |
| `qstash/` | Upstash QStash client: publish and verify typed job payloads |
| `redis/` | Upstash Redis client singleton + `rateLimit()` middleware |
| `ui/` | Shared React component library (shadcn/ui primitives, NativeWind compatible) |
| `validators/` | Per-domain Zod env validators using `@t3-oss/env-core` |

See each package's README for API surface, exports, and usage examples.
