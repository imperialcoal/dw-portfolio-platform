import { clerkMiddleware, createRouteMatcher } from "~/auth/server";

/**
 * Routes that require Clerk authentication (pages only).
 * API routes handle their own auth via requireAdmin().
 */
const isProtectedPage = createRouteMatcher(["/admin(.*)", "/platform(.*)"]);

/**
 * API routes — always bypass Clerk middleware entirely.
 * Each API route handles its own authentication:
 *   - Webhook routes: HMAC / Svix / QStash signature verification
 *   - Platform API routes: requireAdmin() with Clerk session cookie
 *   - Cron routes: CRON_SECRET header
 *   - tRPC: Clerk session via context
 */
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // All API routes bypass middleware — they authenticate themselves.
  // This prevents Clerk's Edge middleware from intercepting POST bodies
  // before they reach Node.js route handlers.
  if (isApiRoute(request)) {
    return;
  }

  // Protected pages require Clerk authentication.
  if (isProtectedPage(request)) {
    await auth.protect();
    return;
  }

  // Everything else (public pages) passes through.
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
