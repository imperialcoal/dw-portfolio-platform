import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getExecutionRuntime,
  isBrowserRuntime,
  isEdgeRuntime,
  isNodeRuntime,
  isTestRuntime,
} from "../src/execution-runtime";

// ─────────────────────────────────────────────
// Helper types for simulating other runtimes
// ─────────────────────────────────────────────

interface GlobalWithRuntime {
  EdgeRuntime?: unknown;
  window?: unknown;
}

// ─────────────────────────────────────────────
// Execution Runtime Detection
// ─────────────────────────────────────────────

describe("Execution Runtime Detection", () => {
  // Save original globalThis state
  const g = globalThis as GlobalWithRuntime;
  let originalEdgeRuntime: unknown;
  let originalWindow: unknown;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalEdgeRuntime = g.EdgeRuntime;
    originalWindow = g.window;
    originalNodeEnv = process.env.NODE_ENV;
    // Clean state before each test
    delete g.EdgeRuntime;
    delete g.window;
  });

  afterEach(() => {
    // Restore globalThis state
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

  describe("getExecutionRuntime()", () => {
    it("returns 'test' in the test environment (NODE_ENV=test)", () => {
      // No EdgeRuntime, no window, NODE_ENV=test (set by vitest.setup.ts)
      process.env.NODE_ENV = "test";
      expect(getExecutionRuntime()).toBe("test");
    });

    it("returns 'edge' when globalThis.EdgeRuntime is defined", () => {
      // Simulate Vercel/Cloudflare Edge runtime
      g.EdgeRuntime = "vercel-edge";
      expect(getExecutionRuntime()).toBe("edge");
    });

    it("returns 'browser' when globalThis.window is defined (no EdgeRuntime)", () => {
      // Simulate browser environment
      g.window = {};
      expect(getExecutionRuntime()).toBe("browser");
    });

    it("returns 'node' when no Edge/Browser signals and NODE_ENV is not test", () => {
      process.env.NODE_ENV = "production";
      expect(getExecutionRuntime()).toBe("node");
    });

    it("prioritizes 'edge' over 'browser' when both are set", () => {
      // Edge takes priority in detection order
      g.EdgeRuntime = "edge";
      g.window = {};
      expect(getExecutionRuntime()).toBe("edge");
    });

    it("prioritizes 'edge' over 'test' NODE_ENV", () => {
      g.EdgeRuntime = "edge";
      process.env.NODE_ENV = "test";
      expect(getExecutionRuntime()).toBe("edge");
    });

    it("prioritizes 'browser' over 'test' NODE_ENV (no EdgeRuntime)", () => {
      g.window = {};
      process.env.NODE_ENV = "test";
      expect(getExecutionRuntime()).toBe("browser");
    });
  });

  describe("Helper boolean functions", () => {
    it("isTestRuntime() returns true in test environment", () => {
      process.env.NODE_ENV = "test";
      expect(isTestRuntime()).toBe(true);
    });

    it("isEdgeRuntime() returns true when EdgeRuntime is set", () => {
      g.EdgeRuntime = "vercel-edge";
      expect(isEdgeRuntime()).toBe(true);
      expect(isNodeRuntime()).toBe(false);
      expect(isBrowserRuntime()).toBe(false);
      expect(isTestRuntime()).toBe(false);
    });

    it("isBrowserRuntime() returns true when window is set", () => {
      g.window = {};
      expect(isBrowserRuntime()).toBe(true);
      expect(isNodeRuntime()).toBe(false);
      expect(isEdgeRuntime()).toBe(false);
    });

    it("isNodeRuntime() returns true in pure Node environment", () => {
      process.env.NODE_ENV = "production";
      expect(isNodeRuntime()).toBe(true);
      expect(isEdgeRuntime()).toBe(false);
      expect(isBrowserRuntime()).toBe(false);
      expect(isTestRuntime()).toBe(false);
    });

    it("exactly one runtime helper returns true at a time", () => {
      process.env.NODE_ENV = "test";
      const results = [
        isNodeRuntime(),
        isEdgeRuntime(),
        isBrowserRuntime(),
        isTestRuntime(),
      ];
      const trueCount = results.filter(Boolean).length;
      expect(trueCount).toBe(1);
    });
  });
});
