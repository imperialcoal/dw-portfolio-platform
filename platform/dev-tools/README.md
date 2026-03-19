# @dw/dev-tools

Local development infrastructure package. Provides Docker Compose configuration for running Postgres and Redis locally, TypeScript scripts for database seeding and test setup, and the shell scripts used by the Turbo task pipeline.

## Purpose

Enables fully local development without any cloud service dependencies. The Docker stack replicates the production environment (PostgreSQL 16, Upstash Redis via HTTP proxy) so developers can run the full application stack offline.

## Architecture

```
docker/
└── docker-compose.yml   # Postgres 16 (port 5433), Redis 7 (port 6379), HTTP proxy (port 8079)

scripts/
└── typescript/
    ├── setup-test-db.ts  # Creates and migrates test database (used in CI)
    └── seed.ts           # Seeds development database with sample data

src/
└── index.ts              # Package entry (minimal — re-exports utilities)
```

### Docker Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| `postgres` | `postgres:16` | `5433` | Primary database (maps to 5432 internally) |
| `redis` | `redis:7` | `6379` | Redis (password protected) |
| `redis-proxy` | `hiett/serverless-redis-http` | `8079` | Upstash REST API emulator |

The `redis-proxy` service (`hiett/serverless-redis-http`) emulates the Upstash Redis HTTP REST API. This means `@dw/redis`'s `getRedis()` function works identically in local dev (pointing to `http://localhost:8079`) and in production (pointing to Upstash cloud), using the same `@upstash/redis` client.

## Usage

```bash
# Start infrastructure
pnpm dw infra up

# Stop infrastructure
pnpm dw infra down

# Restart infrastructure
pnpm dw infra restart

# Stream Docker logs
pnpm dw infra logs

# Set up test database (creates schema, runs migrations)
pnpm -F @dw/dev-tools dev-tools:db:test-setup

# Seed the database
pnpm -F @dw/dev-tools dev-tools:db:seed
```

Infrastructure requires `.env.local` to be present with:
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=dw_portfolio
UPSTASH_REDIS_REST_TOKEN=<any string>
```

## Dependencies

Consumes: `@dw/auth`, `@dw/config`, `@dw/db`, `@dw/env`, `@dw/redis`, `@dw/runtime`

Not consumed by any other package (tooling only).

## Developer Notes

> **Developer Note**
> Postgres maps to port `5433` (not the standard `5432`) to avoid conflicts with any locally installed Postgres instance. Your `.env.local` and all test configs must use `localhost:5433` for the connection string, not `localhost:5432`.
