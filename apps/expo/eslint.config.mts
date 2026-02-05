import { defineConfig } from "eslint/config";

import { baseConfig } from "@dw/eslint-config/base";
import { reactConfig } from "@dw/eslint-config/react";

export default defineConfig(
  {
    ignores: [".expo/**", "expo-plugins/**"],
  },
  baseConfig,
  reactConfig,
);
