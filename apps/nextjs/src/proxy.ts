import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// NOTE: this proxy is setup for only Admins to see login for now

/**
 * Public routes (NO auth required)
 */
// const isPublicRoute = createRouteMatcher([
//   "/",
//   "/sign-in(.*)",
//   "/sign-up(.*)",

//   // APIs that must remain public
//   "/api/trpc(.*)",
//   "/api/webhooks/clerk",
// ]);

// Admin route - NOTE: switch to secret route in production
/**
 * Routes that require authentication
 */
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

/**
 * Routes that must ALWAYS bypass auth
 * (webhooks must never be blocked)
 */
const isWebhookRoute = createRouteMatcher(["/api/webhooks/clerk"]);

export default clerkMiddleware(async (auth, request) => {
  if (isWebhookRoute(request)) {
    return;
  }

  // Entire site = public
  // Only admin area requires authentication
  if (isAdminRoute(request)) {
    await auth.protect();
    return;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
