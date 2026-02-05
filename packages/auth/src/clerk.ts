import type { auth } from "@clerk/nextjs/server";

// Export types for use across your monorepo
export type ClerkAuth = Awaited<ReturnType<typeof auth>>;
export type ClerkUser = ClerkAuth["userId"];

// Shared Clerk configuration
export const clerkConfig = {
  // Add any shared config here
  appearance: {
    // Your custom theming
  },
} as const;
