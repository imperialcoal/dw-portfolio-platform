// ─────────────────────────────────────────────
// Execution runtime detection
//
// Determines which runtime the current code is executing in.
// This is separate from deployment environment (APP_ENV) — you can
// be in "preview" APP_ENV running in either Edge or Node runtime.
// ─────────────────────────────────────────────

export const EXECUTION_RUNTIMES = ["node", "edge", "browser", "test"] as const;

export type ExecutionRuntime = (typeof EXECUTION_RUNTIMES)[number];

// Cast globalThis to a loose type once — avoids repeated casts below
interface GlobalWithRuntime {
  EdgeRuntime?: unknown;
  window?: unknown;
}

/**
 * Detects the current execution runtime.
 *
 * Detection order matters:
 * 1. Edge — checked via globalThis.EdgeRuntime (set by Vercel/Cloudflare)
 * 2. Browser — checked via globalThis.window (avoids dom lib requirement)
 * 3. Test — checked via NODE_ENV
 * 4. Node — default fallback
 */
export function getExecutionRuntime(): ExecutionRuntime {
  const g = globalThis as GlobalWithRuntime;

  // Edge runtime — Vercel Edge and Cloudflare Workers both set EdgeRuntime
  if (typeof g.EdgeRuntime !== "undefined") {
    return "edge";
  }

  // Browser — window is only defined in browser environments.
  // Using globalThis.window instead of window directly avoids the need
  // for the dom lib in tsconfig, which isn't appropriate for server packages.
  if (typeof g.window !== "undefined") {
    return "browser";
  }

  // Test environment
  if (process.env.NODE_ENV === "test") {
    return "test";
  }

  return "node";
}

export function isNodeRuntime(): boolean {
  return getExecutionRuntime() === "node";
}

export function isEdgeRuntime(): boolean {
  return getExecutionRuntime() === "edge";
}

export function isBrowserRuntime(): boolean {
  return getExecutionRuntime() === "browser";
}

export function isTestRuntime(): boolean {
  return getExecutionRuntime() === "test";
}
