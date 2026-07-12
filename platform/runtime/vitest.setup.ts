// Local setup for platform/runtime unit tests.
// Object.assign avoids the readonly NODE_ENV TS error and runs before
// any module import resolves.
Object.assign(process.env, {
  NODE_ENV: process.env.NODE_ENV ?? "test",
  APP_ENV: process.env.APP_ENV ?? "test",
  UPSTASH_REDIS_REST_URL:
    process.env.UPSTASH_REDIS_REST_URL ?? "https://mock-redis.example.com",
  UPSTASH_REDIS_REST_TOKEN:
    process.env.UPSTASH_REDIS_REST_TOKEN ?? "mock_token",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://mock:mock@localhost:5432/mock_test",
  DIRECT_URL:
    process.env.DIRECT_URL ?? "postgresql://mock:mock@localhost:5432/mock_test",
});

await import("@dw/runtime/init");
