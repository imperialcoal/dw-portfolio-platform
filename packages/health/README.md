# @dw/health

Infrastructure health check utilities for the DW Portfolio Platform.

## Overview

This package provides utilities to verify database and Redis connectivity for monitoring and health check endpoints.

## Features

- **Database health checks** - Verify PostgreSQL connectivity
- **Redis health checks** - Verify Redis connectivity
- **Structured responses** - Consistent health check format
- **Fast checks** - Lightweight queries for quick responses

## Exports

```typescript
export { verifyInfra } from "./checks";
export type { DbHealthCheck, RedisHealthCheck } from "./checks";
```

## Usage

### In tRPC Health Endpoint

```typescript
import { verifyInfra } from "@dw/health";

export const healthRouter = {
  check: publicProcedure.query(async ({ ctx }) => {
    const health = await verifyInfra(ctx.db, ctx.redis);
    return health;
  }),
};
```

### Response Format

```typescript
type HealthCheck = {
  database: {
    status: "healthy" | "unhealthy";
    latency: number; // milliseconds
    error?: string;
  };
  redis: {
    status: "healthy" | "unhealthy";
    latency: number; // milliseconds
    error?: string;
  };
  overall: "healthy" | "degraded" | "unhealthy";
};
```

### Example Response

```json
{
  "database": {
    "status": "healthy",
    "latency": 12
  },
  "redis": {
    "status": "healthy",
    "latency": 5
  },
  "overall": "healthy"
}
```

## Development

```bash
# Build TypeScript
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## Dependencies

None - this package has no external dependencies.

## Related Packages

- [`@dw/api`](../api/README.md) - Uses health checks in internal procedures
- [`@dw/db`](../db/README.md) - Database to check
- [`@dw/redis`](../redis/README.md) - Redis to check
