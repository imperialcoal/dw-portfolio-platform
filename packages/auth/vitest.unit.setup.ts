// Unit test setup for @dw/auth.
// Sets mock env vars before @dw/runtime/init fires through the transitive
// import chain. Cannot use ~/env — this file bootstraps the environment.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
Object.assign(process.env, {
  NODE_ENV: process.env.NODE_ENV ?? "test",
  APP_ENV: process.env.APP_ENV ?? "test",
  UPSTASH_REDIS_REST_URL:
    process.env.UPSTASH_REDIS_REST_URL ?? "https://mock-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN:
    process.env.UPSTASH_REDIS_REST_TOKEN ?? "mock_token",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://mock:mock@localhost:5432/mock_test",
  DIRECT_URL:
    process.env.DIRECT_URL ?? "postgresql://mock:mock@localhost:5432/mock_test",
});
