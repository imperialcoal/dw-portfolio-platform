// Unit tests — no infrastructure required.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    include: ["__tests__/**/*.test.ts"],
  },
});
