import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRedis } from "@dw/redis";

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
    vi.resetModules();
  });

  it("Bootstraps successfully with valid configuration", async () => {
    const { ensurePlatformBooted } = await import("../src/boot-guard");

    process.env.APP_ENV = "local";
    process.env.NODE_ENV = "development";
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";

    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    await expect(ensurePlatformBooted()).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Platform booted"),
    );
  });

  it("Prevents booting if APP_ENV is missing", async () => {
    const { ensurePlatformBooted } = await import("../src/boot-guard");

    delete process.env.APP_ENV;

    await expect(ensurePlatformBooted()).rejects.toThrow(/Invalid APP_ENV/);
  });
});

describe("Runtime Singletons", () => {
  cleanEnv();

  it("runtimeRedis() succeeds in test runtime (test runs in real Node.js)", () => {
    // test runtime has full Node.js capabilities — TCP sockets, filesystem, etc.
    // assertNodeRuntime() correctly allows test runtime through.
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";
    expect(() => runtimeRedis()).not.toThrow();
  });

  it("runtimeDb() succeeds in test runtime (test runs in real Node.js)", () => {
    process.env.APP_ENV = "test";
    expect(() => runtimeDb()).not.toThrow();
  });

  it("runtimeDb() throws assertNodeRuntime error in edge runtime", () => {
    const g = globalThis as { EdgeRuntime?: unknown };
    g.EdgeRuntime = "edge";
    try {
      expect(() => runtimeDb()).toThrow(
        /requires Node\.js runtime but is running in "edge" runtime/,
      );
    } finally {
      delete g.EdgeRuntime;
    }
  });

  it("runtimeRedis() throws assertNodeRuntime error in edge runtime", () => {
    // Reset singleton so it re-initializes with the edge runtime check
    resetRedis();
    const g = globalThis as { EdgeRuntime?: unknown };
    g.EdgeRuntime = "edge";
    try {
      expect(() => runtimeRedis()).toThrow(
        /requires Node\.js runtime but is running in "edge" runtime/,
      );
    } finally {
      delete g.EdgeRuntime;
    }
  });

  it("runtimeDb() returns same instance on multiple calls (singleton)", () => {
    process.env.APP_ENV = "test";
    const db1 = runtimeDb();
    const db2 = runtimeDb();
    expect(db1).toBe(db2);
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
