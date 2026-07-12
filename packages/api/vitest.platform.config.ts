// Vitest config for the platform dashboard test suite.
// Requires Docker Postgres + Redis -- run via: pnpm test:api:platform:dashboard
//
// Tests the post router role-based access (DEMO_MODE on/off) and the
// demo overlay procedure selection in packages/api/src/demo/.
//
// IMPORTANT: the include path must match the real filename exactly --
// api-platform-dashboard.test.ts, not platform-dashboard.test.ts. A
// filename mismatch here causes "No test files found, exiting with code 1"
// even though the file exists, because vitest's include glob simply doesn't
// match anything.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["../../platform/testing/vitest.env.ts"],
    globalSetup: ["../../platform/testing/vitest.runtime.ts"],
    environment: "node",
    testTimeout: 15000,
    include: ["__tests__/api-platform-dashboard.test.ts"],
  },
});
