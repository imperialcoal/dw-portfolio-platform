// Integration test setup for @dw/auth.
// Sets env vars before @dw/runtime/init fires. Docker services override these
// defaults in CI via the workflow env: block.
Object.assign(process.env, {
  NODE_ENV: process.env.NODE_ENV ?? "test",
  APP_ENV: process.env.APP_ENV ?? "test",
  UPSTASH_REDIS_REST_URL:
    process.env.UPSTASH_REDIS_REST_URL ?? "http://localhost:8079",
  UPSTASH_REDIS_REST_TOKEN:
    process.env.UPSTASH_REDIS_REST_TOKEN ?? "mock_token",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:password@localhost:5433/dw_test",
  DIRECT_URL:
    process.env.DIRECT_URL ??
    "postgresql://postgres:password@localhost:5433/dw_test",
});

await import("@dw/runtime/init");
