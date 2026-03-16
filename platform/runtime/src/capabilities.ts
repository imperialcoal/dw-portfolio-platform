import { getExecutionRuntime } from "./execution-runtime";

// ─────────────────────────────────────────────
// Runtime capability guards
//
// Use these instead of checking runtime directly in business logic.
// This gives you a clear, documented contract for what each runtime
// supports, and makes it easy to update if runtimes change.
// ─────────────────────────────────────────────

/**
 * TCP socket support — required for Postgres drivers and Redis TCP clients.
 * Only available in Node.js runtime.
 */
export function hasTcpSockets(): boolean {
  return getExecutionRuntime() === "node";
}

/**
 * Filesystem access — required for reading files at runtime.
 * Only available in Node.js runtime.
 */
export function hasFilesystem(): boolean {
  return getExecutionRuntime() === "node";
}

/**
 * Long-running processes — required for AI agent execution,
 * LLM API calls, and multi-step workflows.
 * Only available in Node.js runtime.
 */
export function hasLongRunningProcesses(): boolean {
  return getExecutionRuntime() === "node";
}

/**
 * Node.js built-in modules — required for packages that import
 * node:crypto, node:http, node:stream, etc.
 * Only available in Node.js runtime.
 */
export function hasNodeBuiltins(): boolean {
  return getExecutionRuntime() === "node";
}

/**
 * Web Crypto API — available in Edge, Node (18+), and Browser.
 * Not available in old Node versions but your platform targets Node 20+.
 */
export function hasWebCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

/**
 * fetch API — available in Edge, Node (18+), and Browser.
 */
export function hasFetch(): boolean {
  return typeof fetch !== "undefined";
}

/**
 * Process handlers (unhandledRejection, uncaughtException) —
 * only meaningful in Node.js runtime.
 */
export function hasProcessHandlers(): boolean {
  return getExecutionRuntime() === "node" || getExecutionRuntime() === "test";
}

// ─────────────────────────────────────────────
// Assertion helpers — throw on misuse
// ─────────────────────────────────────────────

/**
 * Asserts that the current runtime supports TCP sockets.
 * Call this at the top of functions that require Node.js-only SDKs
 * to get a clear error message instead of a cryptic SDK crash.
 */
export function assertNodeRuntime(context: string): void {
  if (!hasTcpSockets()) {
    const runtime = getExecutionRuntime();
    throw new Error(
      `${context} requires Node.js runtime but is running in "${runtime}" runtime. ` +
        `This code path must only be called from Node.js route handlers.`,
    );
  }
}
