// Unit tests — mocked Anthropic SDK, no API key required.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["../../platform/testing/vitest.env.ts"],
    environment: "node",
    testTimeout: 10000,
    include: ["__tests__/**/*.test.ts"],
  },
});
