import { describe, expect, it } from "vitest";

import { createRuntimeContext } from "../src/context";
import { cleanEnv } from "./utils";

// createRuntimeContext() calls runtimeDb() and runtimeRedis() which both
// call assertNodeRuntime(). In test runtime (NODE_ENV=test), these correctly
// throw — the context is only meant to be created from Node.js route handlers.
//
// This test verifies that behavior is correct and the error is clear.
describe("Runtime Context", () => {
  cleanEnv();

  it("throws assertNodeRuntime when called in test runtime", () => {
    process.env.APP_ENV = "test";
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";

    // Correct behavior — createRuntimeContext() must only be called from
    // Node.js route handlers (e.g. /api/webhooks/clerk/route.ts which has
    // export const runtime = "nodejs"). The guard prevents accidental usage
    // in Edge routes or test contexts that bypass the runtime check.
    expect(() => createRuntimeContext()).toThrow(
      /requires Node\.js runtime but is running in "test" runtime/,
    );
  });

  it("throws with a clear message identifying the function context", () => {
    process.env.APP_ENV = "test";

    expect(() => createRuntimeContext()).toThrow(
      /This code path must only be called from Node\.js route handlers/,
    );
  });
});
