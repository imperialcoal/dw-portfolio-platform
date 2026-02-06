# @dw/expo

The mobile application for the DW Portfolio Platform, built with Expo SDK 54 and React Native.

## Overview

A cross-platform mobile app built with Expo featuring:

- **Expo SDK 54** with React Native 0.81
- **React 19** for modern React features
- **NativeWind v5** for Tailwind-like styling in React Native
- **End-to-end type safety** with tRPC v11
- **Better Auth** for authentication
- **Expo Router** for file-based navigation

## Tech Stack

- **Framework**: Expo SDK 54
- **React Native**: 0.81.5
- **React**: 19.1.4
- **TypeScript**: 5.9.3
- **Styling**: NativeWind 5.0.0-preview.2 (Tailwind CSS for React Native)
- **Navigation**: Expo Router v6
- **API Client**: tRPC v11.9.0
- **Data Fetching**: TanStack Query v5.90.8
- **Authentication**: Better Auth 1.4.0-beta.9 with Expo integration
- **UI Library**: React Native built-in components

## Project Structure

```
apps/expo/
├── src/
│   ├── app/                    # Expo Router file-based routing
│   │   ├── (tabs)/             # Tab navigation
│   │   ├── _layout.tsx         # Root layout
│   │   └── index.tsx           # Home screen
│   ├── components/             # React Native components
│   ├── utils/                  # Utilities
│   │   ├── api.tsx             # tRPC React client setup
│   │   └── auth.ts             # Better Auth client setup
│   └── styles/                 # Global styles
├── assets/                     # Images, fonts, etc.
├── .env                        # Environment variables (gitignored)
├── app.json                    # Expo configuration
├── tailwind.config.ts          # Tailwind/NativeWind config
├── tsconfig.json               # TypeScript configuration
└── package.json
```

## Environment Variables

Environment variables are managed via Expo's environment system and can be configured in:

1. **Local development**: Expo Constants
2. **EAS Build**: EAS Secrets
3. **Runtime**: Expo Secure Store for sensitive data

Required environment variables:

```bash
# API URL (points to Next.js backend)
EXPO_PUBLIC_API_URL=http://localhost:3000

# Better Auth
AUTH_REDIRECT_PROXY_URL=http://localhost:3000/api/auth
```

Note: For production, update `EXPO_PUBLIC_API_URL` to your deployed Next.js URL.

## Development

### Prerequisites

1. **Infrastructure running**: Next.js backend must be running

   ```bash
   # From monorepo root
   pnpm dev:next
   ```

2. **Development device/emulator**:
   - iOS: Xcode and iOS Simulator
   - Android: Android Studio and Emulator

### Start Development

```bash
# From monorepo root
pnpm dev

# Or from this directory
cd apps/expo
pnpm dev
```

Then:

- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app (iOS/Android)

### Platform-Specific Development

```bash
# iOS Simulator
pnpm dev:ios

# Android Emulator
pnpm dev:android

# Specific device
pnpm dev --device
```

### Available Commands

```bash
# Development
pnpm dev              # Start Expo dev server
pnpm dev:ios          # Start on iOS Simulator
pnpm dev:android      # Start on Android Emulator

# Build
pnpm ios              # Build and run iOS locally
pnpm android          # Build and run Android locally

# Code Quality
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript compiler
pnpm format           # Check Prettier formatting

# Utilities
pnpm clean            # Clean build artifacts
```

## Features

### Authentication

This app uses **Better Auth** for authentication:

- Email/password login and registration
- Session management with Expo Secure Store
- OAuth via Next.js proxy (configured with Clerk)

**OAuth Flow**:

1. User taps "Sign in with Google" in Expo app
2. App opens Next.js OAuth proxy in web browser
3. User authenticates via Clerk on Next.js
4. Clerk redirects back to Expo app with session token
5. Expo app stores session in Secure Store

```typescript
import { authClient } from "~/utils/auth";

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "password123",
});

// Sign out
await authClient.signOut();
```

### API Layer

tRPC provides end-to-end type-safe APIs:

```typescript
import { api } from "~/utils/api";

export function PostList() {
  const { data: posts, isLoading } = api.post.getAll.useQuery();

  if (isLoading) return <ActivityIndicator />;

  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => <PostItem post={item} />}
    />
  );
}
```

### Navigation

Expo Router provides file-based navigation:

```typescript
import { Link, useRouter } from "expo-router";

export function HomeScreen() {
  const router = useRouter();

  return (
    <View>
      {/* Declarative navigation */}
      <Link href="/posts/123">View Post</Link>

      {/* Imperative navigation */}
      <Button title="Go to Profile" onPress={() => router.push("/profile")} />
    </View>
  );
}
```

### Styling with NativeWind

NativeWind brings Tailwind CSS to React Native:

```typescript
import { View, Text } from "react-native";

export function Card() {
  return (
    <View className="rounded-lg bg-white p-4 shadow-lg">
      <Text className="text-lg font-bold text-gray-900">Card Title</Text>
      <Text className="text-sm text-gray-600">Card content here</Text>
    </View>
  );
}
```

## Deployment

### Build for Production

This app uses **EAS Build** for production builds:

#### 1. Install EAS CLI

```bash
pnpm add -g eas-cli
```

#### 2. Login and Configure

```bash
cd apps/expo
eas login
eas build:configure
```

This creates `eas.json` with build profiles.

#### 3. Build for App Stores

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# Both
eas build --platform all --profile production
```

#### 4. Submit to Stores

```bash
# iOS App Store
eas submit --platform ios --latest

# Google Play Store
eas submit --platform android --latest
```

### Over-the-Air (OTA) Updates

For minor updates that don't require app store approval:

#### 1. Setup EAS Update

```bash
cd apps/expo
pnpm expo install expo-updates
eas update:configure
```

#### 2. Publish Update

```bash
# After building and submitting to stores
eas update --auto
```

Users will receive the update next time they open the app.

## Configuration

### app.json

Expo configuration including:

- App name and identifiers
- iOS and Android specific settings
- Splash screen and icons
- Permissions
- EAS project ID

```json
{
  "expo": {
    "name": "DW Portfolio",
    "slug": "dw-portfolio",
    "scheme": "dwportfolio",
    "ios": {
      "bundleIdentifier": "com.dw.portfolio"
    },
    "android": {
      "package": "com.dw.portfolio"
    }
  }
}
```

### API URL Configuration

The `getBaseUrl` function in `src/utils/api.tsx` determines the backend URL:

```typescript
const getBaseUrl = () => {
  // In production, use your deployed Next.js URL
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Local development
  return "http://localhost:3000";
};
```

Update `EXPO_PUBLIC_API_URL` for production builds.

## Platform-Specific Considerations

### iOS

- Requires Xcode and macOS for local development
- Apple Developer account required for TestFlight and App Store
- iOS Simulator included with Xcode

### Android

- Android Studio required for local development
- Google Play Console account required for Play Store
- Android Emulator included with Android Studio

## Troubleshooting

### Metro Bundler Issues

If Metro bundler hangs or shows errors:

```bash
# Clear Metro cache
pnpm dev -- --clear

# Or manually
rm -rf .expo .cache node_modules
pnpm install
```

### tRPC Connection Errors

If API calls fail:

1. Ensure Next.js backend is running: `pnpm dev:next`
2. Check `EXPO_PUBLIC_API_URL` is correct
3. For iOS Simulator: Use `http://localhost:3000`
4. For Android Emulator: Use `http://10.0.2.2:3000`
5. For physical device: Use your computer's IP address

### Authentication Issues

If authentication isn't working:

1. Ensure Better Auth is configured on Next.js
2. Verify OAuth proxy URL is correct
3. Check Expo Secure Store permissions
4. Clear app data and reinstall

### NativeWind Styles Not Applying

If Tailwind classes aren't working:

1. Ensure `tailwind.config.ts` is configured correctly
2. Check NativeWind is imported in root layout
3. Restart Metro bundler with `--clear` flag

## Related Packages

This app depends on:

- [`@dw/api`](../../packages/api/README.md) - tRPC routers (dev dependency for types)
- [`@dw/auth`](../../packages/auth/README.md) - Authentication client
- [`@dw/tailwind-config`](../../platform/standards/tailwind/README.md) - Shared Tailwind config

Note: `@dw/api` is a **dev dependency** only. The Expo app never bundles backend code.

## Contributing

When modifying this app:

1. Follow Expo Router conventions for navigation
2. Use NativeWind for styling consistency
3. Maintain end-to-end type safety with tRPC
4. Test on both iOS and Android
5. Run `pnpm lint:fix` and `pnpm format:fix` before committing
6. Ensure `@dw/api` remains a dev dependency only
