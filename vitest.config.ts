import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./platform/testing/vitest.env.ts"],
    globalSetup: ["./platform/testing/vitest.runtime.ts"],
    projects: ["packages/*", "apps/*", "platform/runtime"],
  },
});
