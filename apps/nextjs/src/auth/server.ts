import type { WebhookEvent } from "@clerk/backend";
import {
  auth,
  clerkClient,
  clerkMiddleware,
  createRouteMatcher,
  currentUser,
} from "@clerk/nextjs/server";

export { auth, clerkClient, clerkMiddleware, currentUser, createRouteMatcher };
export type { WebhookEvent };

/**
 * Helper to get auth or throw
 * Use this in Server Components or Server Actions
 */
export async function requireAuth() {
  const authResult = await auth();

  if (!authResult.userId) {
    throw new Error("Unauthorized");
  }

  return authResult;
}

/**
 * Helper to get current user or throw
 * Use this when you need full user data
 */
export async function requireUser() {
  const user = await currentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
