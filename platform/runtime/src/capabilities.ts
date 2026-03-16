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
 * Available in Node.js and test runtimes. NOT available in Edge or Browser.
 */
export function hasTcpSockets(): boolean {
  const runtime = getExecutionRuntime();
  return runtime === "node" || runtime === "test";
}

/**
 * Filesystem access — required for reading files at runtime.
 * Available in Node.js and test runtimes.
 */
export function hasFilesystem(): boolean {
  const runtime = getExecutionRuntime();
  return runtime === "node" || runtime === "test";
}

/**
 * Long-running processes — required for AI agent execution,
 * LLM API calls, and multi-step workflows.
 * Available in Node.js and test runtimes.
 */
export function hasLongRunningProcesses(): boolean {
  const runtime = getExecutionRuntime();
  return runtime === "node" || runtime === "test";
}

/**
 * Node.js built-in modules — required for packages that import
 * node:crypto, node:http, node:stream, etc.
 * Available in Node.js and test runtimes.
 */
export function hasNodeBuiltins(): boolean {
  const runtime = getExecutionRuntime();
  return runtime === "node" || runtime === "test";
}

/**
 * Web Crypto API — available in Edge, Node (18+), Browser, and test.
 * Your platform targets Node 22 which has Web Crypto built in.
 */
export function hasWebCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

/**
 * fetch API — available in Edge, Node (18+), Browser, and test.
 */
export function hasFetch(): boolean {
  return typeof fetch !== "undefined";
}

/**
 * Process handlers (unhandledRejection, uncaughtException) —
 * meaningful in Node.js and test runtimes.
 */
export function hasProcessHandlers(): boolean {
  const runtime = getExecutionRuntime();
  return runtime === "node" || runtime === "test";
}

// ─────────────────────────────────────────────
// Assertion helpers — throw on misuse
// ─────────────────────────────────────────────

/**
 * Asserts that the current runtime supports TCP sockets (Node or test).
 * Throws only for Edge and Browser runtimes where Node.js SDKs cannot run.
 *
 * Why test is allowed: vitest runs in a real Node.js process with full
 * access to TCP sockets, filesystem, and Node built-ins. NODE_ENV=test
 * is not a runtime restriction — it's an environment signal.
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
