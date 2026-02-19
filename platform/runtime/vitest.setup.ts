// Local setup for runtime unit tests.
// Runs before @dw/runtime/init so mock env vars are in place before any
// validation fires. Does not import vitest.env.ts for this reason.
process.env.NODE_ENV ??= "test";
process.env.APP_ENV ??= "test";

// Valid HTTPS URLs to pass @dw/env schema validation — no real connections made
process.env.UPSTASH_REDIS_REST_URL ??= "https://mock-redis.example.com";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "mock_token";
process.env.DATABASE_URL ??= "postgresql://mock:mock@localhost:5432/mock_test";
process.env.DIRECT_URL ??= "postgresql://mock:mock@localhost:5432/mock_test";
