import { baseConfig, restrictEnvAccess } from "@dw/eslint-config/base";
import { nextjsConfig } from "@dw/eslint-config/nextjs";
import { reactConfig } from "@dw/eslint-config/react";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
