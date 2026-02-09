# @dw/auth

Authentication layer supporting Clerk (OAuth) for the DW Portfolio Platform.

## Overview

This package provides authentication configuration and utilities for both web (Next.js) and mobile (Expo) applications. It supports:

- **Clerk**: OAuth providers (Google, GitHub, etc.) for social login

## Features

- **Clerk configuration** for Next.js web app
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

### OAuth Flow (via Clerk Proxy)

```typescript
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

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

## Type Safety

Clerk types are exported for use across the monorepo:

```typescript
import type { ClerkAuth, ClerkUser } from "@dw/auth";

// ClerkAuth = Return type of auth() from Clerk
// ClerkUser = userId from ClerkAuth
```

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

#### OAuth (via Clerk Proxy)

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
# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

## Scripts

## Dependencies

- `@clerk/nextjs` - Clerk Next.js SDK
- `@dw/db` - Database layer (for schema generation)
- `@t3-oss/env-core` - Environment variable validation
- `zod` - Schema validation

## Best Practices

1. **Use Clerk for OAuth** - Easier to manage social providers
2. **Keep auth logic in this package** - Don't scatter across apps
3. **Validate environment variables** - Use `authEnv()` to catch missing vars early
4. **Sync Clerk users to database** - Enables querying users with Drizzle
5. **Use OAuth proxy for Expo** - Simplifies mobile OAuth significantly
6. **Secure Expo storage** - Always use `expo-secure-store` for tokens
7. **Separate CLI config from runtime** - Keep `script/` separate from `src/`

## Troubleshooting

### Clerk OAuth Not Working

1. Verify publishable key is correct
2. Check callback URLs in Clerk dashboard
3. Ensure webhook secret is set

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
