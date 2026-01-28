import { baseConfig } from "@dw/eslint-config/base";
import { reactConfig } from "@dw/eslint-config/react";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
