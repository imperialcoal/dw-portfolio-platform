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
  {
    // baseConfig's last block sets languageOptions.parserOptions.projectService
    // with no `files` restriction, so it applies to every file ESLint sees —
    // including .astro ones. astro-eslint-parser doesn't support
    // projectService and downgrades it to `project: true`, which then fails
    // to find a tsconfig.json (it resolves relative to tsconfigRootDir, which
    // is base.ts's own directory, platform/standards/eslint/ — not an
    // ancestor of anything under apps/astro/). Typed linting for .astro was
    // deliberately skipped (see astro.ts) — this override actually enforces
    // that, rather than relying on omission alone.
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: false,
      },
    },
  },
);
