// Integration tests for the AI memory layer.
// Requires Docker Redis only — no Postgres needed.
//
// NOTE: Does NOT include globalSetup vitest.runtime.ts because that guard
// checks DATABASE_URL contains "test", which is not relevant for Redis-only
// tests. The memory layer has zero Postgres dependency.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["../../platform/testing/vitest.env.ts"],
    environment: "node",
    testTimeout: 15000,
    include: ["__tests__/**/*.test.ts"],
  },
});
