# apps/

This directory contains deployable applications in the monorepo.

| App | Package | Description |
|---|---|---|
| `nextjs/` | `@dw/nextjs` | Primary web app: portfolio site + admin platform dashboard |
| `expo/` | `@dw/expo` | React Native mobile app (Expo SDK 54) |

Both apps consume shared packages from `packages/` and are orchestrated by Turborepo. See each app's README for setup and development instructions.
