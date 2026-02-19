import { describe, expect, it } from "vitest";

import { createRuntimeContext } from "../src/context";
import { cleanEnv } from "./utils";

// Ensures context creation doesn't throw
describe("Runtime Context", () => {
  cleanEnv();

  it("creates context with db and redis", () => {
    process.env.APP_ENV = "test";
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";

    const ctx = createRuntimeContext();

    expect(ctx.db).toBeDefined();
    expect(ctx.redis).toBeDefined();
  });
});
