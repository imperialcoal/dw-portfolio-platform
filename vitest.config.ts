import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Root-level setup applies when running vitest from the root directly.
    // Each workspace project declares its own setup — see individual configs.
    setupFiles: ["./platform/testing/vitest.env.ts"],
    globalSetup: ["./platform/testing/vitest.runtime.ts"],
    projects: ["packages/*", "apps/*", "platform/*"],
  },
});
