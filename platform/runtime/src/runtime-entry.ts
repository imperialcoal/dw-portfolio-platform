import { loadEnv } from "@dw/env";

import { bootstrapInfra } from "./bootstrap";
import { isNodeRuntime } from "./execution-runtime";
import { setupProcessHandlers } from "./process";

let initialized = false;

/**
 * Initializes the platform runtime.
 *
 * Safe to call multiple times — only runs once per process lifetime.
 * Skips infrastructure bootstrap in Edge runtime and production.
 */
export async function runtimeEntry() {
  if (initialized) return;
  initialized = true;

  // Process handlers only make sense in Node.js
  if (isNodeRuntime()) {
    setupProcessHandlers();
  }

  loadEnv();

  // Bootstrap (infra verification) only runs in Node.js runtime
  // and only in non-production environments.
  // Edge functions skip this entirely — they have no access to
  // Postgres or Redis directly.
  if (isNodeRuntime() && process.env.APP_ENV !== "production") {
    await bootstrapInfra();
  }
}
