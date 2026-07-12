import eslintPluginAstro from "eslint-plugin-astro";
import { defineConfig } from "eslint/config";

// eslint-plugin-astro's own semver policy note: minor releases can change
// recommended rules/behavior (they don't follow ESLint's stricter semver
// policy). Pinned with a caret in package.json rather than loosely, per
// the plugin's own recommendation — bump deliberately, not automatically.
//
// Typed linting (parserOptions.project for .astro files) is deliberately
// NOT configured here — astro-eslint-parser's own docs note it requires
// temporarily materializing a .tsx file per .astro file to parse it, which
// adds real overhead for comparatively little payoff versus the recommended
// rule set. Revisit only if a specific typed-lint rule becomes necessary.
export const astroConfig = defineConfig(
  ...eslintPluginAstro.configs.recommended,
);
