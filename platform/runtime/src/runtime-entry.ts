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

  // Bootstrap (infra verification) only runs locally against Docker.
  // Vercel environments (preview/production) skip this — cloud infra
  // is always available and does not need startup verification.
  // Tests use their own mocked infra setup via vitest.setup.ts.
  if (isNodeRuntime() && process.env.APP_ENV === "local") {
    await bootstrapInfra();
  }
}
