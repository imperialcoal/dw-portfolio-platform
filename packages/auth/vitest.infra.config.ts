import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./vitest.infra.setup.ts"],
    globalSetup: ["../../platform/testing/vitest.runtime.ts"],
    environment: "node",
    testTimeout: 15000,
    include: ["__tests__/auth-infra.test.ts"],
  },
});
