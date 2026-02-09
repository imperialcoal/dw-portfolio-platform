import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Use a setup file to override the DATABASE_URL env var before tests run
    setupFiles: ["./test/setup.ts"],
  },
});
