// Minimal setup for runtime unit tests - no infra connections needed
process.env.NODE_ENV ??= "test";
process.env.APP_ENV ??= "test";

// Use valid HTTPS URLs to pass validation, but they won't be called due to mocks
process.env.UPSTASH_REDIS_REST_URL ??= "https://mock-redis.example.com";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "mock_token";
process.env.DATABASE_URL ??= "postgresql://mock:mock@localhost:5432/mock_test";
