import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Use a setup file to override the DATABASE_URL env var before tests run
    setupFiles: ["./tests/setup.ts"],
    globalSetup: [
      "../../platform/dev-tools/scripts/typescript/setup-test-db.ts",
    ],
  },
});
