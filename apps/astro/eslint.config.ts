import { defineConfig } from "eslint/config";

import { astroConfig } from "@dw/eslint-config/astro";
import { baseConfig } from "@dw/eslint-config/base";

// No reactConfig — this app has no @astrojs/react integration, no JSX.
// No restrictEnvAccess — that rule targets process.env / a ~/env t3-env
// module (see platform/standards/eslint/base.ts), neither of which this
// app has; it reads import.meta.env.CAREER_DATA_URL directly (Vite/Astro
// convention), which the rule doesn't touch anyway.
export default defineConfig(
  {
    ignores: ["dist/**", ".astro/**"],
  },
  baseConfig,
  astroConfig,
);
