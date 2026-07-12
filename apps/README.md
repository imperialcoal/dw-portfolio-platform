# apps/

This directory contains deployable applications in the monorepo.

| App       | Package      | Description                                                                   |
| --------- | ------------ | ----------------------------------------------------------------------------- |
| `astro/`  | `@dw/astro`  | Recruiter-facing portfolio site (static, deployed to the preview domain only) |
| `nextjs/` | `@dw/nextjs` | Primary web app: portfolio site + admin platform dashboard                    |
| `expo/`   | `@dw/expo`   | React Native mobile app (Expo SDK 54)                                         |

All three apps consume shared packages from `packages/` and are orchestrated by Turborepo. See each app's README for setup and development instructions.
