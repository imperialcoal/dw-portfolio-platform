import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Intentionally does NOT use platform/testing/vitest.env.ts or
    // vitest.runtime.ts — runtime tests mock all infra and need to set their
    // own env vars before any @dw/runtime/init import fires.
    setupFiles: ["./vitest.setup.ts"],
    globalSetup: ["../../platform/testing/vitest.runtime.ts"],
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
