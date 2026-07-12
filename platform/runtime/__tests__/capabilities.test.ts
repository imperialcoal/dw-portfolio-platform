import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertNodeRuntime,
  hasFetch,
  hasFilesystem,
  hasLongRunningProcesses,
  hasNodeBuiltins,
  hasProcessHandlers,
  hasTcpSockets,
  hasWebCrypto,
} from "../src/capabilities";

interface GlobalWithRuntime {
  EdgeRuntime?: unknown;
  window?: unknown;
}

describe("Runtime Capabilities", () => {
  const g = globalThis as GlobalWithRuntime;
  let originalEdgeRuntime: unknown;
  let originalWindow: unknown;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalEdgeRuntime = g.EdgeRuntime;
    originalWindow = g.window;
    originalNodeEnv = process.env.NODE_ENV;
    delete g.EdgeRuntime;
    delete g.window;
  });

  afterEach(() => {
    if (originalEdgeRuntime !== undefined) {
      g.EdgeRuntime = originalEdgeRuntime;
    } else {
      delete g.EdgeRuntime;
    }
    if (originalWindow !== undefined) {
      g.window = originalWindow;
    } else {
      delete g.window;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  // ─────────────────────────────────────────────
  // Node-only capabilities (also available in test)
  // ─────────────────────────────────────────────

  describe("Node capabilities (true in Node and test, false in Edge/Browser)", () => {
    it("hasTcpSockets() — true in test runtime", () => {
      // The vitest process runs in Node.js with full TCP access.
      // NODE_ENV=test returns "test" runtime which correctly has TCP sockets.
      process.env.NODE_ENV = "test";
      expect(hasTcpSockets()).toBe(true);
    });

    it("hasTcpSockets() — true in node runtime", () => {
      process.env.NODE_ENV = "production";
      expect(hasTcpSockets()).toBe(true);
    });

    it("hasTcpSockets() — false in edge runtime", () => {
      g.EdgeRuntime = "edge";
      expect(hasTcpSockets()).toBe(false);
    });

    it("hasTcpSockets() — false in browser runtime", () => {
      g.window = {};
      expect(hasTcpSockets()).toBe(false);
    });

    it("hasFilesystem() — true in test and node, false in edge", () => {
      process.env.NODE_ENV = "test";
      expect(hasFilesystem()).toBe(true);

      process.env.NODE_ENV = "production";
      expect(hasFilesystem()).toBe(true);

      g.EdgeRuntime = "edge";
      expect(hasFilesystem()).toBe(false);
    });

    it("hasLongRunningProcesses() — true in test and node, false in edge", () => {
      process.env.NODE_ENV = "test";
      expect(hasLongRunningProcesses()).toBe(true);

      g.EdgeRuntime = "edge";
      expect(hasLongRunningProcesses()).toBe(false);
    });

    it("hasNodeBuiltins() — true in test and node, false in edge", () => {
      process.env.NODE_ENV = "test";
      expect(hasNodeBuiltins()).toBe(true);

      process.env.NODE_ENV = "production";
      expect(hasNodeBuiltins()).toBe(true);

      g.EdgeRuntime = "edge";
      expect(hasNodeBuiltins()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // Cross-runtime capabilities
  // ─────────────────────────────────────────────

  describe("Cross-runtime capabilities (available in Node 18+)", () => {
    it("hasWebCrypto() — true in Node 20+ test environment", () => {
      expect(hasWebCrypto()).toBe(true);
    });

    it("hasFetch() — true in Node 18+ test environment", () => {
      expect(hasFetch()).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // Process handlers
  // ─────────────────────────────────────────────

  describe("hasProcessHandlers()", () => {
    it("returns true in test runtime", () => {
      process.env.NODE_ENV = "test";
      expect(hasProcessHandlers()).toBe(true);
    });

    it("returns true in node runtime", () => {
      process.env.NODE_ENV = "production";
      expect(hasProcessHandlers()).toBe(true);
    });

    it("returns false in edge runtime", () => {
      g.EdgeRuntime = "edge";
      expect(hasProcessHandlers()).toBe(false);
    });

    it("returns false in browser runtime", () => {
      g.window = {};
      expect(hasProcessHandlers()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // assertNodeRuntime
  // ─────────────────────────────────────────────

  describe("assertNodeRuntime()", () => {
    it("throws with a clear message when called in edge runtime", () => {
      g.EdgeRuntime = "edge";
      expect(() => assertNodeRuntime("runtimeRedis()")).toThrow(
        /runtimeRedis\(\) requires Node\.js runtime but is running in "edge" runtime/,
      );
    });

    it("throws with a clear message when called in browser runtime", () => {
      g.window = {};
      expect(() => assertNodeRuntime("runtimeDb()")).toThrow(
        /runtimeDb\(\) requires Node\.js runtime but is running in "browser" runtime/,
      );
    });

    it("includes context name in the error message", () => {
      g.EdgeRuntime = "edge";
      expect(() => assertNodeRuntime("myDatabaseFunction()")).toThrow(
        /myDatabaseFunction\(\)/,
      );
    });

    it("does NOT throw in node runtime", () => {
      process.env.NODE_ENV = "production";
      expect(() => assertNodeRuntime("runtimeRedis()")).not.toThrow();
    });

    it("does NOT throw in test runtime — test runs in real Node.js", () => {
      process.env.NODE_ENV = "test";
      // vitest runs in a real Node.js process — TCP sockets, filesystem,
      // and Node built-ins are all available. The guard must not block tests.
      expect(() => assertNodeRuntime("runtimeRedis()")).not.toThrow();
    });
  });
});
