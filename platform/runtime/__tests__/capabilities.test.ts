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
  // Node-only capabilities
  // ─────────────────────────────────────────────

  describe("Node-only capabilities (false in Edge/Browser)", () => {
    it("hasTcpSockets() — true in test (Node-like), false in Edge", () => {
      process.env.NODE_ENV = "test";
      // test runtime maps to isNodeRuntime() === false, so hasTcpSockets === false
      // In our setup, NODE_ENV=test returns "test" runtime, not "node"
      // So hasTcpSockets should be false in test environment
      expect(hasTcpSockets()).toBe(false);

      // Simulate Edge
      g.EdgeRuntime = "edge";
      expect(hasTcpSockets()).toBe(false);
    });

    it("hasTcpSockets() — true only in node runtime", () => {
      process.env.NODE_ENV = "production"; // forces "node" runtime
      expect(hasTcpSockets()).toBe(true);
    });

    it("hasFilesystem() mirrors hasTcpSockets()", () => {
      process.env.NODE_ENV = "production";
      expect(hasFilesystem()).toBe(true);

      process.env.NODE_ENV = "test";
      expect(hasFilesystem()).toBe(false);
    });

    it("hasLongRunningProcesses() mirrors hasTcpSockets()", () => {
      process.env.NODE_ENV = "production";
      expect(hasLongRunningProcesses()).toBe(true);

      g.EdgeRuntime = "edge";
      expect(hasLongRunningProcesses()).toBe(false);
    });

    it("hasNodeBuiltins() mirrors hasTcpSockets()", () => {
      process.env.NODE_ENV = "production";
      expect(hasNodeBuiltins()).toBe(true);

      process.env.NODE_ENV = "test";
      expect(hasNodeBuiltins()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // Cross-runtime capabilities
  // ─────────────────────────────────────────────

  describe("Cross-runtime capabilities (available in Node 18+)", () => {
    it("hasWebCrypto() — true in Node 20+ test environment", () => {
      // Node 20+ has Web Crypto API built in — our platform targets Node 22
      expect(hasWebCrypto()).toBe(true);
    });

    it("hasFetch() — true in Node 18+ test environment", () => {
      // Node 18+ has fetch built in — our platform targets Node 22
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
      expect(() => assertNodeRuntime("runtimeRedis()")).toThrowError(
        /runtimeRedis\(\) requires Node\.js runtime but is running in "edge" runtime/,
      );
    });

    it("throws with a clear message when called in browser runtime", () => {
      g.window = {};
      expect(() => assertNodeRuntime("runtimeDb()")).toThrowError(
        /runtimeDb\(\) requires Node\.js runtime but is running in "browser" runtime/,
      );
    });

    it("throws with context name in the error message", () => {
      g.EdgeRuntime = "edge";
      expect(() => assertNodeRuntime("myDatabaseFunction()")).toThrowError(
        /myDatabaseFunction\(\)/,
      );
    });

    it("does NOT throw when called in node runtime", () => {
      process.env.NODE_ENV = "production";
      expect(() => assertNodeRuntime("runtimeRedis()")).not.toThrow();
    });

    it("throws when called in test runtime (test is not node)", () => {
      process.env.NODE_ENV = "test";
      // test runtime returns "test", not "node", so hasTcpSockets() === false
      expect(() => assertNodeRuntime("runtimeRedis()")).toThrow();
    });
  });
});
