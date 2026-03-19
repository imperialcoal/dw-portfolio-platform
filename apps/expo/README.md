# @dw/expo

React Native mobile application for the portfolio platform, built with Expo SDK 54 and Expo Router. Provides a mobile interface for viewing and creating posts, backed by the same tRPC API as the web application.

## Purpose

Mobile companion app that consumes the shared `@dw/api` tRPC router. Demonstrates cross-platform type safety — the same API types, Zod validators, and tRPC client contracts are shared between the Next.js web app and this Expo app.

## Architecture

```
src/
├── app/
│   ├── index.tsx          # Home screen: post list + create post form
│   └── post/[id]/         # Post detail screen
├── utils/
│   └── api.ts             # tRPC client for React Native (HTTP transport)
└── _layout.tsx            # Root layout with TRPCReactProvider + QueryClientProvider
```

## Tech Stack

- Expo SDK 54
- Expo Router 6 (file-system routing)
- tRPC 11 (`@trpc/tanstack-react-query`)
- TanStack Query 5
- NativeWind (Tailwind CSS for React Native)
- LegendList (high-performance list rendering)
- expo-secure-store (secure token storage)

## Key Exports / API Surface

This app does not export a public API. The entry point is `index.ts` (Expo convention).

The tRPC client in `src/utils/api.ts` uses HTTP transport pointing to the same `/api/trpc` endpoint as the web app, with `@dw/api`'s `AppRouter` type for full end-to-end type safety.

## Dependencies

Consumes:

- `@dw/api` — tRPC `AppRouter` type
- `@dw/auth` — auth types
- `@dw/ui` — shared UI primitives

No other monorepo packages depend on this app.

## Local Development

```bash
# Start Expo dev server
pnpm dev

# Run on Android (requires Android Studio / emulator)
pnpm dev:android

# Run on iOS (requires Xcode / simulator, macOS only)
pnpm dev:ios

# Build for Android
pnpm android

# Build for iOS
pnpm ios
```

The app connects to the tRPC API at `NEXT_PUBLIC_APP_URL/api/trpc`. In local dev, this should point to the running Next.js dev server. Update `src/utils/api.ts` or set the environment variable accordingly.

EAS configuration is in `eas.json` for managed builds/submissions.

## Developer Notes

> **Developer Note**
> The `MobileAuth` component in `src/app/index.tsx` is commented out. Clerk auth for React Native requires additional native setup (expo-secure-store + OAuth flow). The comments serve as a placeholder for when mobile auth is implemented. The tRPC mutations already handle the `UNAUTHORIZED` error code and display appropriate UI.
