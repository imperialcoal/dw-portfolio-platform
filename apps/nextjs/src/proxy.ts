import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// NOTE: this proxy is setup for only Admins to see login for now
// Define public routes that don't require authentication
// const isPublicRoute = createRouteMatcher([
//   "/",
//   "/sign-in(.*)",
//   "/sign-up(.*)",
//   "/api/trpc(.*)", // Public tRPC routes - you can restrict specific procedures
//   "/api/webhooks/clerk", // OAuth via Clerk
// ]);

// Admin route - NOTE: switch to secret route in production
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  // if (!isPublicRoute(request)) {
  //   await auth.protect();
  // }
  // Entire site = public
  // Only admin requires login
  if (isAdminRoute(request)) {
    await auth.protect();
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
