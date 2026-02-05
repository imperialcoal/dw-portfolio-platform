import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@dw/eslint-config/base";
import { nextjsConfig } from "@dw/eslint-config/nextjs";
import { reactConfig } from "@dw/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
