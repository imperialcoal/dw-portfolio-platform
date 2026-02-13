// Minimal setup for runtime unit tests - no infra connections needed
process.env.NODE_ENV ??= "test";
process.env.APP_ENV ??= "test";

// Mock Redis env vars to prevent connection errors
process.env.UPSTASH_REDIS_REST_URL ??= "https://mock-redis.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "mock_token";
