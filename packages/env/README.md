# @dw/env

Minimal package that exposes a `loadEnv()` function for loading `.env.local` into `process.env` once per process. Used by CLI scripts and test setup that run outside the Next.js / Vite build pipeline (which handle env loading automatically).

## Purpose

Provides a single, consistent way to load local environment variables for Node.js scripts, CLI commands, and test runners that do not have access to the framework's env loading lifecycle.

## Key Exports

```typescript
/**
 * Load .env.local into process.env once.
 * Runtime env variables always win (override: false).
 */
export function loadEnv(): void
```

### Usage

```typescript
import { loadEnv } from "@dw/env";

loadEnv();
// process.env.DATABASE_URL is now available
```

`override: false` ensures that variables already in the environment (e.g., set by Docker or Doppler) are never replaced by `.env.local` values. This is the correct behavior for CI and production environments.

## Dependencies

No monorepo dependencies.

Consumed by: `@dw/runtime`, `@dw/dev-tools`
