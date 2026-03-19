# @dw/runtime

Runtime environment detection, capability guards, and singleton context factories for the platform. Provides the foundational layer that enforces correct usage of Node.js-only resources (Postgres, Redis) across different Next.js execution runtimes (Node.js, Edge, browser).

## Purpose

Next.js routes can run in three distinct runtimes (Node.js, Edge, browser), each with different capability constraints. This package provides a consistent API for detecting the current runtime and asserting that capabilities are available before using them — preventing silent failures where Node.js-only code runs in an Edge context.

## Architecture

```
src/
├── execution-runtime.ts     # getExecutionRuntime() → "node" | "edge" | "browser" | "test"
├── capabilities.ts          # Capability guards: hasTcpSockets(), hasFilesystem(), etc.
├── singletons.ts            # runtimeDb() and runtimeRedis() — guarded singleton accessors
├── context.ts               # createRuntimeContext() → { db, redis }
├── bootstrap.ts             # bootstrapInfra() — verifies DB + Redis connectivity
├── boot-guard.ts            # assertBootConditions() — startup assertions
├── deployment-environment.ts # getDeploymentEnvironment() — production/preview/local
├── platform-identity.ts     # Platform identity and metadata
├── process.ts               # Process-level lifecycle handlers
├── runtime-entry.ts         # Main server entry point (calls bootstrap, sets up handlers)
├── secret-source.ts         # SecretSource abstraction for env vs. Vault
└── init.ts                  # Module initialization
```

## Key Exports

```typescript
// Runtime detection
export function getExecutionRuntime(): "node" | "edge" | "browser" | "test"

// Capability guards (return boolean)
export function hasTcpSockets(): boolean
export function hasFilesystem(): boolean
export function hasLongRunningProcesses(): boolean
export function hasNodeBuiltins(): boolean
export function hasWebCrypto(): boolean
export function hasFetch(): boolean

// Assertion guard (throws on wrong runtime)
export function assertNodeRuntime(context: string): void

// Guarded singleton accessors
export function runtimeDb(): DbInstance       // asserts Node runtime
export function runtimeRedis(): Redis         // asserts Node runtime

// Context factory (used in tRPC context creation)
export function createRuntimeContext(): { db: DbInstance; redis: Redis }

// Bootstrap (used in server startup)
export async function bootstrapInfra(): Promise<void>
```

### Runtime Guard Pattern

```typescript
// In any package that requires Node.js:
import { assertNodeRuntime } from "@dw/runtime/capabilities";

export function runtimeDb() {
  assertNodeRuntime("runtimeDb()");  // throws in Edge/Browser
  return getDb();
}
```

## Export Paths

This package has granular export paths for tree-shaking:
`"."`, `"./bootstrap"`, `"./boot-guard"`, `"./capabilities"`, `"./context"`, `"./deployment-environment"`, `"./execution-runtime"`, `"./init"`, `"./platform-identity"`, `"./process"`, `"./runtime-entry"`, `"./secret-source"`, `"./singletons"`

## Dependencies

Consumes: `@dw/db`, `@dw/env`, `@dw/health`, `@dw/redis`

Consumed by: `@dw/ai`, `@dw/api`

## Developer Notes

> **Developer Note**
> The test runtime (`getExecutionRuntime() === "test"`) is treated as equivalent to Node.js for all capability checks. This is intentional — Vitest runs in a real Node.js process with full TCP socket, filesystem, and built-in module support. `NODE_ENV=test` is an environment signal, not a runtime restriction, so `hasTcpSockets()` correctly returns `true` in tests, allowing the DB and Redis clients to initialize normally.
