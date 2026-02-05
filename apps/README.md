# Apps

This directory contains the consumer-facing applications that make up the DW Portfolio Platform.

## Applications

### [@dw/nextjs](./nextjs/README.md)

The primary web application built with Next.js 16 and React 19.

- **Framework**: Next.js 16.1.6 with App Router
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Authentication**: Clerk (OAuth) + Better Auth
- **API**: tRPC v11 client with TanStack Query
- **Deployment**: Vercel-optimized

**Use cases**:
- Main web interface for the platform
- Admin dashboard and content management
- Public-facing portfolio pages
- OAuth callback handling for Expo

[View detailed documentation →](./nextjs/README.md)

### [@dw/expo](./expo/README.md)

The mobile application built with Expo SDK 54 and React Native.

- **Framework**: Expo SDK 54 with Expo Router
- **Styling**: NativeWind v5 (Tailwind for React Native)
- **Authentication**: Better Auth with Expo integration
- **API**: tRPC v11 client with TanStack Query
- **Deployment**: EAS Build & Submit

**Use cases**:
- Native iOS and Android applications
- Mobile-optimized user experience
- Offline-first features with local storage

[View detailed documentation →](./expo/README.md)

## Shared Architecture

Both applications share:

- **Type-safe API layer** via `@dw/api` (tRPC)
- **Unified authentication** via `@dw/auth`
- **Shared UI components** via `@dw/ui` (web-only)
- **Validation schemas** via `@dw/validators`
- **Development standards** from `platform/standards`

## Development

### Start all apps

```bash
# From monorepo root
pnpm dev
```

This starts both Next.js and Expo in watch mode using Turborepo.

### Start individual apps

```bash
# Next.js only
pnpm dev:next

# Next.js with infrastructure check
pnpm dev:next:check

# Expo only (iOS)
cd apps/expo
pnpm dev:ios

# Expo only (Android)
cd apps/expo
pnpm dev:android
```

## Code Sharing Strategy

### What to share

- **API contracts**: All tRPC router types from `@dw/api`
- **Business logic**: Data fetching, validation, state management
- **Utilities**: Date formatting, string manipulation, etc.
- **Type definitions**: Shared TypeScript types

### What NOT to share

- **UI components**: Web and mobile have different component libraries
  - Web uses `@dw/ui` (shadcn/ui + Radix)
  - Mobile uses Expo's built-in components + NativeWind
- **Navigation**: Different paradigms (Next.js App Router vs. Expo Router)
- **Platform-specific APIs**: Web APIs vs. React Native APIs

## Type Safety

Both apps enjoy end-to-end type safety:

```typescript
// Shared tRPC router definition (packages/api)
export const postRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(posts);
  }),
});

// Next.js usage (apps/nextjs)
import { api } from "~/trpc/server";
const posts = await api.post.getAll();

// Expo usage (apps/expo)
import { api } from "~/utils/api";
const { data: posts } = api.post.getAll.useQuery();
```

## Environment Configuration

Each app has its own environment variable requirements:

- **Next.js**: `.env.local` at monorepo root (loaded via `with-env` script)
- **Expo**: Reads from Expo's environment system + local storage

See individual app READMEs for specific environment variable requirements.

## Deployment

- **Next.js**: Deployed to Vercel (see [deployment guide](./nextjs/README.md#deployment))
- **Expo**: Built and submitted via EAS (see [deployment guide](./expo/README.md#deployment))

Both apps can run independently but share the same backend infrastructure (tRPC API, PostgreSQL, Redis).
