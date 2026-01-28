import { baseConfig, restrictEnvAccess } from "@dw/eslint-config/base";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  restrictEnvAccess,
);
