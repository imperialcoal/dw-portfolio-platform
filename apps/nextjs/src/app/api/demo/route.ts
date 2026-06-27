// Demo sign-in — generates a one-time Clerk sign-in token for the
// pre-provisioned demo recruiter account and redirects to the sign-in
// page. The visitor never sees credentials; the token is single-use
// and expires in 5 minutes.
//
// GET /api/demo → 302 /sign-in?__clerk_ticket=<token>&redirect_url=/platform
//
// Guards:
//   - 302 → / when DEMO_MODE=false
//   - 302 → /sign-in when Clerk is unconfigured or DEMO_USER_CLERK_ID is missing
//
// Sits alongside the existing trigger routes in src/app/api/demo/trigger/*.
// To remove: delete this file and revert Project.astro CTA href to the
// plain dev.dw-portfolio.dev URL.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@dw/validators/clerk-env";

import { clerkClient } from "~/auth/server";
import { isDemoMode } from "~/demo";
import { env } from "~/env";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Guard: only available in demo mode
  if (!isDemoMode()) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Guard: Clerk must be configured
  if (!isClerkConfigured()) {
    console.warn(
      JSON.stringify({
        level: "warn",
        demo: "sign-in",
        reason: "clerk-not-configured",
      }),
    );
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const userId = env.DEMO_USER_CLERK_ID;
  if (!userId) {
    console.warn(
      JSON.stringify({
        level: "warn",
        demo: "sign-in",
        reason: "demo-user-id-not-configured",
      }),
    );
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  try {
    const client = await clerkClient();
    const { token } = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 300, // 5 minutes — ample time to land on sign-in page
    });

    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("__clerk_ticket", token);
    signInUrl.searchParams.set("redirect_url", "/platform");

    return NextResponse.redirect(signInUrl);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        demo: "sign-in",
        error: String(err),
      }),
    );
    // Graceful fallback — recruiter lands on the standard sign-in page
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
}
