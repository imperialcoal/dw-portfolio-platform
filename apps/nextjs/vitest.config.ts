import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Uses shared env setup (imports @dw/runtime/init + sets NODE_ENV/APP_ENV)
    // and the runtime guard (warns if DATABASE_URL isn't a test DB).
    setupFiles: ["../../platform/testing/vitest.env.ts"],
    globalSetup: ["../../platform/testing/vitest.runtime.ts"],
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
