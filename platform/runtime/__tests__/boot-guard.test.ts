import { beforeEach, describe, expect, it, vi } from "vitest";

// import { resetRedis } from "@dw/redis";

import { bootstrapInfra } from "../src/bootstrap";
import { runtimeDb, runtimeRedis } from "../src/singletons";
import { cleanEnv } from "./utils";

// Mock the infrastructure modules
vi.mock("@dw/health", () => ({
  verifyInfra: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@dw/redis", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@dw/redis")>();
  return {
    ...actual,
    clearRedis: vi.fn().mockResolvedValue(undefined),
  };
});

describe("Boot Guard Integration", () => {
  cleanEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state to clear the 'booted' flag
    vi.resetModules();
  });

  it("Bootstraps successfully with valid configuration", async () => {
    // Re-import after reset to get fresh module state
    const { ensurePlatformBooted } = await import("../src/boot-guard");

    process.env.APP_ENV = "local";
    process.env.NODE_ENV = "development";
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";

    // Spy on console to keep test output clean and verify logging
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    await expect(ensurePlatformBooted()).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Platform booted"),
    );
  });

  it("Prevents booting if APP_ENV is missing", async () => {
    // Re-import after reset to get fresh module state
    const { ensurePlatformBooted } = await import("../src/boot-guard");

    delete process.env.APP_ENV;

    await expect(ensurePlatformBooted()).rejects.toThrow(/Invalid APP_ENV/);
  });
});

describe("Runtime Singletons", () => {
  cleanEnv();

  it("runtimeRedis() throws assertNodeRuntime error in test runtime", () => {
    // Clear the singleton so getRedis() re-initializes from env -- NOTE: currently not being used
    // resetRedis();
    // delete process.env.UPSTASH_REDIS_REST_URL;
    // delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // The test runtime returns "test" (not "node"), so assertNodeRuntime() throws.
    // This is the correct behavior — runtimeRedis() must only be called from
    // Node.js route handlers, not from Edge or test contexts directly.
    // In real usage the process routes (runtime = "nodejs") call this correctly.
    expect(() => runtimeRedis()).toThrow(
      /requires Node\.js runtime but is running in "test" runtime/,
    );
  });

  it("runtimeDb() throws assertNodeRuntime error in test runtime", () => {
    expect(() => runtimeDb()).toThrow(
      /requires Node\.js runtime but is running in "test" runtime/,
    );
  });

  it("runtimeDb() returns same instance on multiple calls (singleton) in node runtime", () => {
    // Temporarily simulate node runtime for singleton test
    const g = globalThis as { EdgeRuntime?: unknown };
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = "production"; // forces "node" runtime
      delete g.EdgeRuntime;

      process.env.APP_ENV = "test";

      const db1 = runtimeDb();
      const db2 = runtimeDb();
      expect(db1).toBe(db2); // Same reference — singleton behavior
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

describe("Runtime Entry", () => {
  cleanEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("skips bootstrap in production", async () => {
    const { runtimeEntry } = await import("../src/runtime-entry");

    process.env.APP_ENV = "production";
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    await runtimeEntry();

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Initializing local infra"),
    );
  });
});

describe("Infrastructure Bootstrap", () => {
  cleanEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("exits process on infra failure in test mode", async () => {
    const { verifyInfra } = await import("@dw/health");
    process.env.APP_ENV = "test";
    process.env.NODE_ENV = "test";
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";

    vi.mocked(verifyInfra).mockRejectedValueOnce(
      new Error("Connection failed"),
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(bootstrapInfra()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
