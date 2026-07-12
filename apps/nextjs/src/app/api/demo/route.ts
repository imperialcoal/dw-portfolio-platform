// Demo sign-in — generates a one-time Clerk sign-in token for the
// pre-provisioned demo recruiter account and redirects to Clerk's
// sign-in URL. The visitor never sees credentials; the token is
// single-use and expires in 5 minutes.
//
// GET /api/demo → 302 <clerk-sign-in-url>?__clerk_ticket=<token>&redirect_url=/platform
//
// Guards:
//   - 302 → / when DEMO_MODE=false
//   - 302 → / when Clerk is unconfigured or DEMO_USER_CLERK_ID is missing
//
// Session handling: a Clerk sign-in ticket is only honored when the
// requesting browser has no conflicting active session — if one exists,
// Clerk silently keeps using it and the ticket has no effect. This route
// unconditionally revokes whatever session is currently active (admin,
// a previous recruiter session, anyone) before minting the ticket, so
// this link always produces a fresh recruiter session — including when
// clicked from a browser that's already signed in as admin for testing.
// This is a correctness guarantee, not an admin-specific check: the same
// revoke runs regardless of whose session it is.
//
// Sits alongside the existing trigger routes in src/app/api/demo/trigger/*.
// To remove: delete this file and revert Project.astro CTA href to the
// plain dev.dw-portfolio.dev URL.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@dw/validators/clerk-env";

import { auth, clerkClient } from "~/auth/server";
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
    return NextResponse.redirect(new URL("/", req.url));
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
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const client = await clerkClient();

    // Revoke any existing session on this browser first — see file-header
    // comment. Best-effort: if this fails (e.g. session already expired),
    // we still proceed to mint and redirect the ticket rather than dead-end
    // the demo link over an unrelated revoke error.
    const { sessionId: existingSessionId } = await auth();
    if (existingSessionId) {
      try {
        await client.sessions.revokeSession(existingSessionId);
      } catch (revokeErr) {
        console.warn(
          JSON.stringify({
            level: "warn",
            demo: "sign-in",
            reason: "existing-session-revoke-failed",
            error: String(revokeErr),
          }),
        );
      }
    }

    const result = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 300, // 5 minutes
    });

    // result.url is Clerk's own sign-in URL with __clerk_ticket already set.
    // Works for both hosted and embedded sign-in pages — do not hardcode /sign-in.
    const signInUrl = new URL(result.url);
    signInUrl.searchParams.set(
      "redirect_url",
      new URL("/platform", req.url).toString(),
    );

    return NextResponse.redirect(signInUrl.toString());
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        demo: "sign-in",
        error: String(err),
      }),
    );
    return NextResponse.redirect(new URL("/", req.url));
  }
}
