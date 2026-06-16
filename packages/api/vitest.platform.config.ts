// Vitest config for the platform dashboard test suite.
// Requires Docker Postgres + Redis — run via: pnpm test:platform:dashboard
//
// Tests the post router role-based access (DEMO_MODE on/off) and the
// demo overlay procedure selection in packages/api/src/demo/.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["../../platform/testing/vitest.env.ts"],
    globalSetup: ["../../platform/testing/vitest.runtime.ts"],
    environment: "node",
    testTimeout: 15000,
    include: ["__tests__/platform-dashboard.test.ts"],
  },
});
