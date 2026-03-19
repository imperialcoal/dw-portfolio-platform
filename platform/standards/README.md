# platform/standards

Shared configuration packages for code quality tools across the monorepo. Every workspace package references these standards rather than defining its own configuration, ensuring consistency.

## Contents

| Directory | Package | Description |
|---|---|---|
| `eslint/` | `@dw/eslint-config` | Base ESLint 9 flat config with `@eslint/js`, TypeScript rules, and Next.js/React presets |
| `typescript/` | `@dw/tsconfig` | TypeScript config presets: `base.json`, `compiled-package.json`, `executable.json` |
| `tailwind/` | `@dw/tailwind-config` | Shared Tailwind CSS 4 theme configuration and PostCSS config |
| `prettier/` | `@dw/prettier-config` | Shared Prettier config with `prettier-plugin-tailwindcss` and `@ianvs/prettier-plugin-sort-imports` |
| `github/` | — | Reusable GitHub Actions composite action (`setup`) for pnpm + Node + Turbo cache setup |

## Usage

### ESLint

```typescript
// In any package's eslint.config.ts
import baseConfig from "@dw/eslint-config/base";
import nextjsConfig from "@dw/eslint-config/nextjs";

export default [...baseConfig, ...nextjsConfig];
```

### TypeScript

```json
// In any package's tsconfig.json
{
  "extends": "@dw/tsconfig/base.json",
  "compilerOptions": { ... }
}
```

### GitHub Actions Setup

```yaml
# In any workflow job
- name: Setup
  uses: ./platform/standards/github/setup
# Runs: actions/setup-node, pnpm install, configures Turbo remote cache
```

### Prettier

```json
// In any package.json
{
  "prettier": "@dw/prettier-config"
}
```
