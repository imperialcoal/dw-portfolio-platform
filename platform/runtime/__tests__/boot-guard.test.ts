import { afterEach, describe, expect, it, vi } from "vitest";

import { clearRedis } from "@dw/redis";

import { ensurePlatformBooted } from "../src/boot-guard";
import { bootstrapInfra } from "../src/bootstrap";
import { runtimeDb, runtimeRedis } from "../src/singletons";
import { cleanEnv } from "./helpers";

describe("Boot Guard Integration", () => {
  cleanEnv();

  afterEach(async () => {
    await clearRedis();
  });

  it("Bootstraps successfully with valid configuration", async () => {
    process.env.APP_ENV = "local";
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
    delete process.env.APP_ENV;

    await expect(ensurePlatformBooted()).rejects.toThrow(/Invalid APP_ENV/);
  });
});

describe("Runtime Singletons", () => {
  it("throws when required env vars are missing", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;

    expect(() => runtimeRedis()).toThrow(
      /Missing required environment variable: UPSTASH_REDIS_REST_URL/,
    );
  });

  it("returns same instance on multiple calls (singleton behavior)", () => {
    const db1 = runtimeDb();
    const db2 = runtimeDb();
    expect(db1).toBe(db2); // Should be same reference
  });
});

describe("Infrastructure Bootstrap", () => {
  it("skips bootstrap in production", async () => {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    await bootstrapInfra();

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Initializing local infra"),
    );
  });

  it("exits process on infra failure in test mode", async () => {
    process.env.APP_ENV = "test";
    process.env.NODE_ENV = "test";
    process.env.UPSTASH_REDIS_REST_URL = "http://invalid-url";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(bootstrapInfra()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
