import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@dw/eslint-config/base";

export default defineConfig(
  {
    // vitest setup files must set process.env directly before runtime init fires.
    // They cannot use ~/env (that's what they're bootstrapping).
    ignores: ["script/**", "vitest.*.setup.ts"],
  },
  baseConfig,
  restrictEnvAccess,
);
