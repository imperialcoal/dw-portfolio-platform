import { describe, expect, it } from "vitest";

import { createRuntimeContext } from "../src/context";

// Ensures context creation doesn't throw
describe("Runtime Context", () => {
  it("creates context with db and redis", () => {
    process.env.APP_ENV = "test";
    process.env.UPSTASH_REDIS_REST_URL = "mock";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock";

    const ctx = createRuntimeContext();

    expect(ctx.db).toBeDefined();
    expect(ctx.redis).toBeDefined();
  });
});
