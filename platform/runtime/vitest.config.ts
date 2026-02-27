import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Intentionally does NOT use platform/testing/vitest.env.ts or
    // vitest.runtime.ts — runtime tests mock all infra and need to set their
    // own env vars before any @dw/runtime/init import fires.
    setupFiles: ["./vitest.setup.ts"],
    // No globalSetup — runtime tests are pure unit tests with mocked infra.
    // The shared vitest.runtime.ts guard is for integration tests only.
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
