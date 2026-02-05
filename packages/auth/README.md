# @dw/auth

Unified authentication layer supporting Clerk (OAuth) and Better Auth (email/password) for the DW Portfolio Platform.

## Overview

This package provides authentication configuration and utilities for both web (Next.js) and mobile (Expo) applications. It supports:

- **Clerk**: OAuth providers (Google, GitHub, etc.) for social login
- **Better Auth**: Email/password authentication with session management
- **Dual provider support**: Both can coexist for maximum flexibility

## Features

- **Clerk configuration** for Next.js web app
- **Better Auth schema generation** for database tables
- **Type exports** for authentication objects
- **Shared auth utilities** across web and mobile
- **OAuth proxy pattern** for Expo authentication

## Exports

```typescript
// Main exports
export { clerkConfig } from "./clerk";
export type { ClerkAuth, ClerkUser } from "./clerk";
export { authEnv } from "./env";
```

## Package Structure

```
packages/auth/
├── src/
│   ├── index.ts           # Main exports
│   └── clerk.ts           # Clerk configuration and types
├── script/
│   └── auth-cli.ts        # Better Auth CLI config (not imported)
├── env.ts                 # Environment variable validation
└── package.json
```

## Authentication Providers

### Clerk (OAuth)

Clerk is used for OAuth social logins in Next.js.

**Features**:
- Social login (Google, GitHub, etc.)
- Managed authentication UI
- User management dashboard
- Webhook support for user sync
- OAuth proxy for Expo

**Configuration**:

```typescript
import { clerkConfig } from "@dw/auth";

// Use in Next.js layouts or components
<ClerkProvider {...clerkConfig}>
  {children}
</ClerkProvider>
```

**Environment variables**:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

### Better Auth (Email/Password)

Better Auth provides email/password authentication with full control.

**Features**:
- Email/password authentication
- Session management
- Custom auth flows
- Expo integration via `@better-auth/expo`
- Database-backed sessions (stored in PostgreSQL)

**Schema generation**:

Better Auth requires database schema generation:

```bash
# From monorepo root
pnpm auth:generate
```

This runs the Better Auth CLI and generates Drizzle schema in `@dw/db`:

```
Input:  packages/auth/script/auth-cli.ts
Output: packages/db/src/auth-schema.ts
```

**Important**: The `script/auth-cli.ts` file is CLI-only and should NOT be imported in application code. Use the runtime config from `src/index.ts` instead.

## Usage in Next.js

### Clerk Authentication

```typescript
import { auth } from "@clerk/nextjs/server";

export async function ServerComponent() {
  const session = await auth();

  if (!session.userId) {
    return <SignIn />;
  }

  return <Dashboard userId={session.userId} />;
}
```

### Better Auth API Routes

Better Auth requires API routes in Next.js:

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@dw/auth";

export const { GET, POST } = auth.handler;
```

### OAuth Proxy for Expo

The Next.js app acts as an OAuth proxy for Expo:

1. Expo opens Next.js URL in browser
2. User authenticates via Clerk on Next.js
3. Next.js redirects back to Expo with session token
4. Expo stores token in Secure Store

**Configuration**:

```bash
AUTH_REDIRECT_PROXY_URL=https://your-app.vercel.app/api/auth
```

## Usage in Expo

### Better Auth Client

```typescript
import { authClient } from "@better-auth/expo";
import * as SecureStore from "expo-secure-store";

// Configure auth client
export const auth = authClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  storage: {
    get: async (key) => {
      return await SecureStore.getItemAsync(key);
    },
    set: async (key, value) => {
      await SecureStore.setItemAsync(key, value);
    },
    remove: async (key) => {
      await SecureStore.deleteItemAsync(key);
    },
  },
});

// Sign in
await auth.signIn.email({
  email: "user@example.com",
  password: "password123",
});

// Sign out
await auth.signOut();

// Get session
const session = await auth.getSession();
```

### OAuth Flow (via Clerk Proxy)

```typescript
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

// Open OAuth proxy in browser
const redirectUri = makeRedirectUri();
const authUrl = `${AUTH_PROXY_URL}/oauth/google?redirect=${redirectUri}`;

const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

if (result.type === "success") {
  // Extract session token from result.url
  const token = extractToken(result.url);
  await SecureStore.setItemAsync("auth-token", token);
}
```

## Better Auth Schema Generation

The `auth:generate` script uses the Better Auth CLI to create database tables.

### CLI Configuration

```typescript
// script/auth-cli.ts (CLI only - do NOT import)
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@dw/db/client";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // ... other plugins
});
```

### Generated Schema

The output (`packages/db/src/auth-schema.ts`) contains:

- `user` table (accounts)
- `session` table (active sessions)
- `verification` table (email verification)
- `account` table (linked accounts)

These tables are automatically used by Better Auth for session management.

## Type Safety

Clerk types are exported for use across the monorepo:

```typescript
import type { ClerkAuth, ClerkUser } from "@dw/auth";

// ClerkAuth = Return type of auth() from Clerk
// ClerkUser = userId from ClerkAuth
```

Better Auth types are generated automatically and don't need explicit exports.

## Environment Variables

This package validates auth-related environment variables:

```typescript
// env.ts
export const authEnv = createEnv({
  server: {
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_WEBHOOK_SECRET: z.string().min(1),
    AUTH_REDIRECT_PROXY_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
});
```

## Authentication Flow

### Web (Next.js)

1. User clicks "Sign in with Google" (Clerk)
2. Clerk handles OAuth flow
3. User redirected back with session
4. Clerk webhook creates/updates user in database
5. tRPC context loads user from database

### Mobile (Expo)

#### Option 1: Email/Password (Better Auth)

1. User enters email/password
2. Expo calls Better Auth API on Next.js
3. Session token stored in Secure Store
4. Token sent with tRPC requests

#### Option 2: OAuth (via Clerk Proxy)

1. Expo opens Next.js OAuth URL in browser
2. User authenticates via Clerk
3. Next.js redirects back to Expo with token
4. Expo stores token in Secure Store
5. Token sent with tRPC requests

## Webhooks

### Clerk User Sync

Configure Clerk webhook to sync users to database:

**Endpoint**: `https://your-app.com/api/webhooks/clerk`

**Events**:
- `user.created` - Create user in database
- `user.updated` - Update user info
- `user.deleted` - Soft delete user

**Handler** (in Next.js):

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { db } from "@dw/db/client";
import { user } from "@dw/db/schema";

export async function POST(req: Request) {
  const payload = await req.json();
  const headers = req.headers;

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const evt = wh.verify(JSON.stringify(payload), {
    "svix-id": headers.get("svix-id")!,
    "svix-timestamp": headers.get("svix-timestamp")!,
    "svix-signature": headers.get("svix-signature")!,
  });

  if (evt.type === "user.created") {
    await db.insert(user).values({
      id: evt.data.id,
      email: evt.data.email_addresses[0].email_address,
      name: `${evt.data.first_name} ${evt.data.last_name}`,
    });
  }

  return new Response("OK", { status: 200 });
}
```

## Development

```bash
# Generate Better Auth schema
pnpm auth:generate

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

## Scripts

```json
{
  "auth:generate": "dotenv -e ../../.env.local -- pnpx @better-auth/cli generate --config script/auth-cli.ts --output ../db/src/auth-schema.ts"
}
```

## Dependencies

- `@clerk/nextjs` - Clerk Next.js SDK
- `@better-auth/expo` - Better Auth Expo integration
- `better-auth` - Better Auth core
- `@dw/db` - Database layer (for schema generation)
- `@t3-oss/env-core` - Environment variable validation
- `zod` - Schema validation

## Best Practices

1. **Use Clerk for OAuth** - Easier to manage social providers
2. **Use Better Auth for email/password** - More control over auth flow
3. **Keep auth logic in this package** - Don't scatter across apps
4. **Validate environment variables** - Use `authEnv()` to catch missing vars early
5. **Sync Clerk users to database** - Enables querying users with Drizzle
6. **Use OAuth proxy for Expo** - Simplifies mobile OAuth significantly
7. **Secure Expo storage** - Always use `expo-secure-store` for tokens
8. **Separate CLI config from runtime** - Keep `script/` separate from `src/`

## Troubleshooting

### Clerk OAuth Not Working

1. Verify publishable key is correct
2. Check callback URLs in Clerk dashboard
3. Ensure webhook secret is set

### Better Auth Schema Not Generated

1. Run `pnpm auth:generate` from monorepo root
2. Check database connection in `.env.local`
3. Verify `script/auth-cli.ts` has correct config

### Expo Authentication Failing

1. Ensure Next.js backend is accessible from device
2. Verify `AUTH_REDIRECT_PROXY_URL` points to deployed Next.js
3. Check Secure Store permissions in Expo
4. Clear app data and reinstall

## Related Packages

- [`@dw/db`](../db/README.md) - Database layer (auth schema)
- [`@dw/api`](../api/README.md) - tRPC context (auth)
- [Next.js App](../../apps/nextjs/README.md) - Web authentication
- [Expo App](../../apps/expo/README.md) - Mobile authentication
