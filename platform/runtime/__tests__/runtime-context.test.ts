import { describe, expect, it } from "vitest";

import { createRuntimeContext } from "../src/context";
import { cleanEnv } from "./utils";

describe("Runtime Context", () => {
  cleanEnv();

  it("creates context with db and redis in test runtime", () => {
    // Test runtime runs in real Node.js — has full access to TCP sockets,
    // so createRuntimeContext() works correctly here.
    process.env.APP_ENV = "test";
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";

    const ctx = createRuntimeContext();

    expect(ctx.db).toBeDefined();
    expect(ctx.redis).toBeDefined();
  });

  it("throws only when called in edge runtime", () => {
    const g = globalThis as { EdgeRuntime?: unknown };
    g.EdgeRuntime = "edge";

    try {
      expect(() => createRuntimeContext()).toThrow(
        /requires Node\.js runtime but is running in "edge" runtime/,
      );
    } finally {
      delete g.EdgeRuntime;
    }
  });
});
