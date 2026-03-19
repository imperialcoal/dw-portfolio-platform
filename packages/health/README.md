# @dw/health

Infrastructure health check primitives. Provides `verifyInfra()` — a function that confirms Postgres and Redis are reachable with a read/write roundtrip test. Used during bootstrap and test setup to fail fast if infra is unavailable.

## Purpose

Centralizes the infra verification logic so it can be called identically from the runtime bootstrap (`platform/runtime/src/bootstrap.ts`), test setup scripts, and any health check endpoint. The function uses abstract interfaces (`DbHealthCheck`, `RedisHealthCheck`) rather than concrete types, allowing it to be tested with any adapter.

## Key Exports

```typescript
export interface DbHealthCheck {
  execute: (query: string) => Promise<unknown>;
}
export interface RedisHealthCheck {
  ping: () => Promise<string>;
  set: (key: string, value: string, ex: number) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
}

export async function verifyInfra(
  db: DbHealthCheck,
  redis: RedisHealthCheck,
): Promise<void>
```

### Behavior

- Runs DB and Redis checks in parallel with `Promise.all`
- Redis check performs a full roundtrip: `PING` + `SET` + `GET` with value assertion
- Timeout: 3000ms (local), 15000ms (CI — slower Docker startup)
- Includes a safety guard: throws if `NODE_ENV === "test"` but `DATABASE_URL` does not contain `"test"` — prevents tests from accidentally running against a non-test database

## Dependencies

No monorepo dependencies (leaf package).

Consumed by: `@dw/runtime`
