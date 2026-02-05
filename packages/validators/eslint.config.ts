import { defineConfig } from "eslint/config";

import { baseConfig } from "@dw/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
);
