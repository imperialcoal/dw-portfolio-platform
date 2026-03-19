# @dw/testing

Shared Vitest configuration and test environment guards for the monorepo. Provides two Vitest config presets and a runtime guard that fails fast if tests are accidentally run against a non-test database.

## Purpose

Centralizes test configuration so individual packages do not need to define their own Vitest setup from scratch. The runtime guard (`vitest.runtime.ts`) enforces safety invariants that prevent tests from mutating production or development databases.

## Architecture

```
src/
└── index.ts             # Package entry (minimal)

vitest.env.ts            # Environment validation guard (imported in vitest globalSetup)
vitest.runtime.ts        # Runtime-level guard function (call in test setup files)
```

## Key Exports

### `vitest.runtime.ts`

```typescript
// Call this in a globalSetup or beforeAll block for any test suite
// that connects to Postgres or Redis
export default function runtimeGuard(): void
// Throws if:
// - NODE_ENV !== "test"
// - DATABASE_URL does not contain "test"
```

### `vitest.env.ts`

Environment validation that runs before any tests. Imported via Vitest's `globalSetup` configuration option.

## Usage

In a package's `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["../../platform/testing/vitest.env.ts"],
    setupFiles: ["../../platform/testing/vitest.runtime.ts"],
    environment: "node",
  },
});
```

## Test Categories

The monorepo has three test commands with different infrastructure requirements:

| Command | Infra Required | Test Scope |
|---|---|---|
| `pnpm test:runtime` | None (mocked env vars) | Unit/logic tests — no real DB or Redis |
| `pnpm test:api:infra` | Docker (Postgres + Redis) | Integration tests — real DB migrations and queries |
| `pnpm test:clerk:webhook` | Docker (Postgres + Redis) | Clerk webhook handler integration tests |

## Dependencies

No monorepo dependencies (leaf package — only dev dependencies).

Consumed by: `platform/runtime`, `packages/api` (and any future test packages)
