import { clerkMiddleware, createRouteMatcher } from "~/auth/server";

// NOTE: this proxy is setup for only Admins to see login for now

/**
 * Routes that require authentication
 */
const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/platform(.*)"]);

/**
 * Routes that must ALWAYS bypass Clerk middleware.
 *
 * Two categories:
 *
 * 1. Webhook + processor routes — must never be blocked by auth.
 *    These verify their own signatures (HMAC / QStash / Svix).
 *
 * 2. Platform API routes — these run on Node.js runtime and call
 *    requireAdmin() themselves using the Clerk session cookie.
 *    If Clerk middleware intercepts them first, it returns 400
 *    before the route handler ever runs, because middleware runs
 *    in the Edge runtime and can't correctly forward the session
 *    to a Node.js route handler in all cases.
 *
 * 3. Cron routes — authenticated via CRON_SECRET header, not Clerk.
 */
const isWebhookRoute = createRouteMatcher([
  // ── Inbound webhooks (signature-verified) ───────────────────────
  "/api/webhooks/clerk",
  "/api/webhooks/github",
  "/api/webhooks/sentry",

  // ── QStash processor routes (QStash signature-verified) ─────────
  "/api/process/ci",
  "/api/process/sentry",
  "/api/process/resolve",
  "/api/process/security",

  // ── Platform API routes (requireAdmin() handles auth internally) ─
  "/api/platform/(.*)",

  // ── Cron routes (CRON_SECRET header auth) ───────────────────────
  "/api/cron/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isWebhookRoute(request)) {
    return;
  }

  // Entire site = public.
  // Only /admin and /platform pages require Clerk authentication.
  if (isProtectedRoute(request)) {
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
