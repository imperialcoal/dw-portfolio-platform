import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Local setup sets mock env vars synchronously before any module import.
    // Does NOT use platform/testing/vitest.env.ts — that file imports
    // @dw/runtime/init which reads APP_ENV before we can set it.
    setupFiles: ["./vitest.unit.setup.ts"],
    environment: "node",
    include: ["__tests__/auth-unit.test.ts"],
  },
});
