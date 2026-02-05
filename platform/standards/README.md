# Platform Standards

Shared configuration packages for consistent code quality, styling, and tooling across the DW Portfolio Platform.

## Overview

The standards packages provide centralized configurations that are extended by all apps and packages in the monorepo. This ensures consistency and makes it easy to update standards across the entire platform.

## Packages

### [@dw/eslint-config](../../packages/README.md)

ESLint configuration for TypeScript, React, and Next.js.

**Features**:
- TypeScript ESLint rules
- React and React Hooks rules
- Next.js specific rules
- Turbo repo awareness
- Flat config format (ESLint 9+)

**Usage**:

```typescript
// eslint.config.ts
import baseConfig from "@dw/eslint-config";

export default [...baseConfig];
```

### [@dw/prettier-config](../../packages/README.md)

Prettier configuration with plugin support.

**Features**:
- Consistent formatting rules
- Import sorting via `@ianvs/prettier-plugin-sort-imports`
- Tailwind class sorting via `prettier-plugin-tailwindcss`
- 80-character line length
- Single quotes

**Usage**:

```json
{
  "prettier": "@dw/prettier-config"
}
```

### [@dw/tsconfig](../../packages/README.md)

TypeScript configurations for different use cases.

**Features**:
- `base.json` - Strict TypeScript config
- `nextjs.json` - Next.js specific settings
- `react-library.json` - React library settings
- Path aliases support
- Strict mode enabled

**Usage**:

```json
{
  "extends": "@dw/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

### [@dw/tailwind-config](../../packages/README.md)

Shared Tailwind CSS configuration and theme.

**Features**:
- Tailwind CSS v4 configuration
- Shared color palette
- Custom utility classes
- Dark mode support
- Responsive breakpoints

**Usage**:

```typescript
// tailwind.config.ts
import baseConfig from "@dw/tailwind-config";

export default {
  ...baseConfig,
  content: ["./src/**/*.{ts,tsx}"],
};
```

### [@dw/github-standards](../../packages/README.md)

GitHub repository standards including templates and workflows.

**Contents**:
- Issue templates
- Pull request templates
- Discussion templates
- Dependabot configuration
- Renovate configuration

## Configuration Philosophy

### 1. Shared by Default

All apps and packages extend base configurations. Custom rules are added only when necessary.

### 2. Strict but Pragmatic

Configurations enforce best practices but allow escape hatches when needed:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = unknownData; // With justification
```

### 3. Automatically Applied

Configurations are applied via workspace dependencies:

```json
{
  "devDependencies": {
    "@dw/eslint-config": "workspace:*",
    "@dw/prettier-config": "workspace:*",
    "@dw/tsconfig": "workspace:*"
  }
}
```

### 4. Versioned Together

All standards use `workspace:*` versioning and update together.

## Standards in Practice

### ESLint

**Run linting**:

```bash
pnpm lint              # Check all packages
pnpm lint:fix          # Auto-fix issues
```

**Disable rules** (when justified):

```typescript
/* eslint-disable @typescript-eslint/no-unused-vars */
function experimental() {
  // Work in progress
}
/* eslint-enable @typescript-eslint/no-unused-vars */
```

### Prettier

**Run formatting**:

```bash
pnpm format            # Check formatting
pnpm format:fix        # Auto-format
```

**Ignore files**:

```
# .prettierignore
dist/
.next/
pnpm-lock.yaml
```

### TypeScript

**Type checking**:

```bash
pnpm typecheck         # Check all packages
```

**Custom paths**:

```json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"]
    }
  }
}
```

### Tailwind

**Custom theme**:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#...",
          // ... custom colors
        },
      },
    },
  },
};
```

## Updating Standards

### Making Changes

1. **Modify base configuration** in `platform/standards/`
2. **Test changes** across multiple packages
3. **Document breaking changes** in package README
4. **Update version** if needed
5. **Rebuild packages**: `pnpm install`

### Breaking Changes

When making breaking changes to standards:

1. **Communicate** with team
2. **Provide migration guide**
3. **Update all packages** that extend the config
4. **Test CI** to ensure it passes

## CI Integration

Standards are enforced in CI:

```yaml
# .github/workflows/ci.yml
- name: Lint
  run: pnpm lint

- name: Format Check
  run: pnpm format

- name: Type Check
  run: pnpm typecheck
```

## Editor Integration

### VS Code

Recommended extensions (`.vscode/extensions.json`):

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss"
  ]
}
```

Settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Best Practices

1. **Always extend base configs** - Don't duplicate rules
2. **Document exceptions** - Explain why rules are disabled
3. **Keep configs minimal** - Only override what's necessary
4. **Test changes locally** - Run lint/format/typecheck
5. **Use cache** - ESLint and Prettier support caching

## Related Documentation

- [Root README](../../README.md) - Project overview
- [Development Workflow](../../README.md#development-workflow) - Using these standards
