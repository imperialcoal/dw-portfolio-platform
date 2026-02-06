# @dw/nextjs

The primary web application for the DW Portfolio Platform, built with Next.js 16 and React 19.

## Overview

This is a modern, production-ready Next.js application featuring:

- **Next.js 16** with App Router and React Server Components
- **End-to-end type safety** with tRPC v11 and Drizzle ORM
- **Dual authentication** supporting Clerk (OAuth) and Better Auth (email/password)
- **Modern styling** with Tailwind CSS v4 and shadcn/ui components
- **Optimized performance** with React 19 features and automatic code splitting

## Tech Stack

- **Framework**: Next.js 16.1.6
- **React**: 19.1.4
- **TypeScript**: 5.9.3
- **Styling**: Tailwind CSS v4.1.18
- **UI Components**: shadcn/ui + Radix UI
- **Forms**: TanStack Form
- **API Client**: tRPC v11.9.0
- **Data Fetching**: TanStack Query v5.90.8
- **Authentication**:
  - Clerk (@clerk/nextjs ^6.37.1)
  - Better Auth (1.4.0-beta.9)
- **Database**: Drizzle ORM via `@dw/db`
- **Caching**: Upstash Redis via `@dw/redis`

## Project Structure

```
apps/nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # Better Auth API routes
│   │   │   ├── trpc/           # tRPC API endpoint
│   │   │   └── webhooks/       # Webhook handlers (Clerk, etc.)
│   │   ├── (auth)/             # Auth-related pages
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   ├── lib/                    # Utility functions
│   ├── styles/                 # Global styles
│   ├── trpc/                   # tRPC client setup
│   │   ├── react.tsx           # React Query provider
│   │   └── server.ts           # Server-side tRPC caller
│   └── env.ts                  # Environment variable validation
├── public/                     # Static assets
├── .env.local                  # Environment variables (gitignored)
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── package.json
```

## Environment Variables

Create a `.env.local` file at the monorepo root:

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@127.0.0.1:5433/dbname
DIRECT_URL=postgresql://user:password@127.0.0.1:5433/dbname

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Better Auth
AUTH_REDIRECT_PROXY_URL=http://localhost:3000/api/auth

# Upstash Redis
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=your-token-here

# App Config
PROJECT_NAME=dw-portfolio-platform
PORT=3000
```

See [`.env.example`](../../.env.example) for a complete reference.

## Development

### Prerequisites

1. **Infrastructure running**: PostgreSQL, Redis, Upstash emulator

   ```bash
   pnpm infra:up
   ```

2. **Database schema pushed**:
   ```bash
   pnpm db:push
   ```

### Start Development Server

```bash
# From monorepo root
pnpm dev:next

# Or with infrastructure check
pnpm dev:next:check

# Or from this directory
cd apps/nextjs
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Available Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript compiler
pnpm format           # Check Prettier formatting

# Utilities
pnpm clean            # Clean build artifacts
```

## Features

### Authentication

This app supports two authentication providers:

1. **Clerk (OAuth)**:
   - Social login (Google, GitHub, etc.)
   - Managed authentication UI
   - Webhook integration for user sync
   - Used as OAuth proxy for Expo app

2. **Better Auth (Email/Password)**:
   - Traditional email/password authentication
   - Session management
   - Custom auth flows
   - Shared with Expo app

Both providers are integrated into the tRPC context for unified access control.

### API Layer

tRPC provides end-to-end type-safe APIs:

```typescript
// Server Component (RSC)
import { api } from "~/trpc/server";

export default async function PostsPage() {
  const posts = await api.post.getAll();
  return <PostList posts={posts} />;
}

// Client Component
"use client";
import { api } from "~/trpc/react";

export function CreatePost() {
  const { mutate } = api.post.create.useMutation();

  return (
    <button onClick={() => mutate({ title: "Hello", content: "World" })}>
      Create Post
    </button>
  );
}
```

### Styling

Tailwind CSS v4 is configured with:

- **Shared configuration** from `@dw/tailwind-config`
- **shadcn/ui components** via `@dw/ui`
- **CSS variables** for theming
- **Dark mode** support

Add new UI components:

```bash
pnpm ui-add
```

### Forms

TanStack Form is used for form state management:

```typescript
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";

const form = useForm({
  defaultValues: { title: "", content: "" },
  validators: {
    onChange: createPostSchema,
  },
});
```

## Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Configure project**:
   - Root Directory: `apps/nextjs`
   - Framework Preset: Next.js
   - Build Command: `pnpm build` (auto-detected)
   - Output Directory: `.next` (auto-detected)

3. **Set environment variables**:
   - Add all variables from `.env.local`
   - Ensure `DATABASE_URL` points to production database
   - Update `AUTH_REDIRECT_PROXY_URL` to production URL
   - Configure Clerk production keys

4. **Deploy**: Push to main branch or click "Deploy"

### Build Optimization

The app is optimized for production:

- **Automatic code splitting** via Next.js App Router
- **Server Components** for zero-bundle JS where possible
- **Image optimization** with `next/image`
- **Bundle analysis**: Run `ANALYZE=true pnpm build` to analyze bundle size

### Environment-Specific Configuration

```typescript
// src/env.ts uses @t3-oss/env-nextjs for validation
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    CLERK_SECRET_KEY: z.string().min(1),
    // ... more server-side env vars
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    // ... more client-side env vars
  },
});
```

## Webhooks

### Clerk User Sync

Webhook endpoint: `/api/webhooks/clerk`

Handles Clerk user events:

- `user.created`: Create user in database
- `user.updated`: Update user info
- `user.deleted`: Soft delete or archive user

Configure in Clerk Dashboard:

- URL: `https://your-domain.com/api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`
- Secret: Set `CLERK_WEBHOOK_SECRET` in environment

## Troubleshooting

### tRPC Errors

If you see tRPC errors in the console:

1. Ensure infrastructure is running: `pnpm infra:up`
2. Verify database schema is pushed: `pnpm db:push`
3. Check environment variables are set correctly
4. Restart dev server: `pnpm dev:next`

### Build Errors

If TypeScript errors occur during build:

```bash
# Clean and rebuild
pnpm clean
pnpm build
```

### Authentication Issues

If authentication isn't working:

1. **Clerk**: Verify API keys in environment variables
2. **Better Auth**: Ensure auth schema is generated (`pnpm auth:generate`)
3. **Webhooks**: Check Clerk webhook is configured and receiving events

## Related Packages

This app depends on:

- [`@dw/api`](../../packages/api/README.md) - tRPC routers
- [`@dw/auth`](../../packages/auth/README.md) - Authentication
- [`@dw/db`](../../packages/db/README.md) - Database layer
- [`@dw/redis`](../../packages/redis/README.md) - Redis caching
- [`@dw/ui`](../../packages/ui/README.md) - UI components
- [`@dw/validators`](../../packages/validators/README.md) - Zod schemas

## Contributing

When modifying this app:

1. Follow Next.js App Router conventions
2. Use Server Components by default, Client Components when needed
3. Maintain end-to-end type safety with tRPC
4. Run `pnpm lint:fix` and `pnpm format:fix` before committing
5. Test locally with infrastructure running
