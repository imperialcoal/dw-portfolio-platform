# Platform Dev Tools

Local development infrastructure and utilities for the DW Portfolio Platform.

## Overview

This directory contains everything needed for local development:

- **Docker Compose**: PostgreSQL, Redis, Upstash emulator
- **Shell scripts**: Infrastructure health checks, wait scripts
- **TypeScript scripts**: Database seeding, data generation

## Structure

```
dev-tools/
├── docker/
│   └── docker-compose.yml        # Docker services configuration
├── scripts/
│   ├── shell/                    # Bash scripts
│   │   └── wait-for-docker.sh    # Wait for infrastructure
│   ├── src/                      # TypeScript utilities
│   └── typescript/               # Seeding scripts
│       └── seed.ts               # Database seeding
└── package.json                  # @dw/dev-tools-scripts
```

## Docker Services

### Services

1. **PostgreSQL 16**
   - Port: `5433` (to avoid conflicts with existing PostgreSQL)
   - Database: Configured via `.env.local`
   - Volume: `postgres_data` for persistence

2. **Redis 7**
   - Port: `6379`
   - Password: Set via `UPSTASH_REDIS_REST_TOKEN`
   - Volume: `redis_data` for persistence

3. **Upstash Redis HTTP Proxy**
   - Port: `8079`
   - Purpose: REST API for Redis (serverless-friendly)
   - Acts as Upstash emulator for local dev

### Starting Services

```bash
# From monorepo root
pnpm infra:up

# Stop services
pnpm infra:down

# Restart services
pnpm infra:restart

# View logs
pnpm infra:logs
```

### Docker Compose Configuration

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5433:5432"]
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s

  redis:
    image: redis:7
    ports: ["6379:6379"]
    command: redis-server --requirepass ${UPSTASH_REDIS_REST_TOKEN}
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${UPSTASH_REDIS_REST_TOKEN}", "ping"]

  redis-proxy:
    image: hiett/serverless-redis-http:latest
    ports: ["8079:80"]
    environment:
      - SRH_MODE=env
      - SRH_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
      - SRH_CONNECTION_STRING=redis://:${UPSTASH_REDIS_REST_TOKEN}@redis:6379
```

## Shell Scripts

### wait-for-docker.sh

Waits for Docker services to be healthy before starting development.

**Usage**:

```bash
# Used in dev:check scripts
bash platform/dev-tools/scripts/shell/wait-for-docker.sh && pnpm dev
```

**What it does**:
1. Checks if Docker is running
2. Waits for PostgreSQL to be healthy
3. Waits for Redis to be healthy
4. Times out after 30 seconds

## Database Seeding

### Overview

The seeding script populates the database with test data for local development.

**Package**: `@dw/dev-tools-scripts`

**Usage**:

```bash
# From monorepo root
pnpm dev:seed

# Or directly
pnpm --filter @dw/dev-tools-scripts seed
```

### What Gets Seeded

The seed script creates:
- Test users
- Sample posts
- Any other test data needed

**Location**: `platform/dev-tools/scripts/typescript/seed.ts`

### Customizing Seeds

Edit `seed.ts` to add more test data:

```typescript
import { db } from "@dw/db/client";
import { Post, user } from "@dw/db/schema";

async function seed() {
  // Create test user
  await db.insert(user).values({
    id: "test-user-1",
    email: "test@example.com",
    name: "Test User",
  });

  // Create test posts
  await db.insert(Post).values([
    {
      title: "First Post",
      content: "This is a test post",
      authorId: "test-user-1",
    },
    // ... more posts
  ]);

  console.log("✅ Database seeded successfully");
}

seed().catch(console.error);
```

### Running Seeds

The seed script:
1. Connects to database
2. Inserts test data
3. Reports success/failure

**Important**: Seeds are idempotent when possible (use `onConflictDoNothing()`).

## Development Scripts

### Package: @dw/dev-tools-scripts

This is a workspace package for development utilities.

**Dependencies**:
- `@dw/db` - Database access
- `@dw/redis` - Redis access
- `drizzle-orm` - ORM operations
- `uuid` - UUID generation
- `tsx` - TypeScript execution

**Scripts**:

```json
{
  "seed": "pnpm with-env tsx typescript/seed.ts",
  "with-env": "dotenv -e ../../../.env.local --"
}
```

## Environment Variables

Dev tools read from `.env.local` at monorepo root:

```bash
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=dw_portfolio

# URLs for application
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dw_portfolio
DIRECT_URL=postgresql://postgres:postgres@localhost:5433/dw_portfolio

# Redis
UPSTASH_REDIS_REST_TOKEN=your-token
UPSTASH_REDIS_REST_URL=http://localhost:8079
```

## Adding New Services

To add a new Docker service:

1. **Edit docker-compose.yml**:

```yaml
services:
  # ... existing services ...

  new-service:
    image: your-image:latest
    ports:
      - "1234:1234"
    environment:
      - CONFIG=${ENV_VAR}
    networks:
      - dw-network
    healthcheck:
      test: ["CMD", "check-command"]
```

2. **Add environment variables** to `.env.example` and `.env.local`

3. **Update documentation** in this README

4. **Test**:

```bash
pnpm infra:restart
pnpm infra:logs
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker ps

# View detailed logs
docker compose -f platform/dev-tools/docker/docker-compose.yml logs

# Check ports aren't in use
lsof -i :5433  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :8079  # Upstash emulator
```

### PostgreSQL Connection Errors

```bash
# Verify PostgreSQL is healthy
docker compose -f platform/dev-tools/docker/docker-compose.yml ps

# Test connection
psql postgresql://postgres:postgres@localhost:5433/dw_portfolio

# Check environment variables
cat .env.local | grep DATABASE
```

### Redis Connection Errors

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 -a your-token ping

# Test Upstash HTTP
curl http://localhost:8079
```

### Seeding Fails

```bash
# Ensure infrastructure is running
pnpm infra:up

# Ensure schema is pushed
pnpm db:push

# Run seed with debug output
pnpm dev:seed
```

## Development Workflow

### Initial Setup

```bash
# 1. Start infrastructure
pnpm infra:up

# 2. Wait for services (manual or automatic)
bash platform/dev-tools/scripts/shell/wait-for-docker.sh

# 3. Set up database
pnpm auth:generate
pnpm db:push
pnpm dev:seed

# 4. Start development
pnpm dev
```

### Daily Development

```bash
# Infrastructure should stay running
docker ps  # Verify services are up

# If services stopped, restart
pnpm infra:up
```

### Resetting Development Environment

```bash
# Stop all services
pnpm infra:down

# Remove volumes (deletes all data)
docker volume rm dw-portfolio-platform_postgres_data
docker volume rm dw-portfolio-platform_redis_data

# Start fresh
pnpm infra:up
pnpm db:push
pnpm dev:seed
```

## Related Documentation

- [Root README](../../README.md#development-workflow) - Overall workflow
- [Database Package](../../packages/db/README.md) - Database setup
- [Redis Package](../../packages/redis/README.md) - Redis usage
