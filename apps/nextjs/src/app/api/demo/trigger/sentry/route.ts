// Demo-only endpoint — fires a REAL exception through the actual Sentry
// SDK, letting the genuine, already-configured Sentry webhook alert carry
// it through the same pipeline a real production error would use.
//
// This replaced an earlier synthetic-payload version
// (buildSyntheticSentryPayload + publishSentryJob called directly). That
// approach correctly tested OUR OWN analysis pipeline, but never touched
// Sentry's real infrastructure — which is exactly why every demo-triggered
// incident's "→ Sentry Issue" dashboard link 404'd: the synthetic
// "DEMO-..." ID never corresponded to a real Sentry issue. This version
// creates a genuine, clickable one.
//
// Guarded: requires recruiter or admin role. Returns 404 when
// DEMO_MODE=false. Rate-limited GLOBALLY (not per-user) since this now
// consumes real Sentry event quota, unlike the previous synthetic-payload
// version, which only ever touched infrastructure fully under this
// project's own control (Redis, GitHub, Anthropic).
//
// Flow: POST here → Sentry.captureException() (via the shared
//   ~/lib/sentry-capture helper — the same one /api/test-sentry-error
//   uses) → Sentry's real infrastructure → Sentry's own configured webhook
//   alert fires → /api/webhooks/sentry (existing, unmodified) →
//   publishSentryJob() → QStash → /api/process/sentry → runSentryAgent()
//   → Redis incident record.
//
// This makes the round trip genuinely asynchronous — expect several
// seconds between this response and the incident appearing on the
// dashboard, unlike the previous near-instant synthetic version. Worth
// reflecting that delay in the demo panel's UI copy if it currently
// implies an immediate result.
//
// Auth uses getRequestAuthority() + canViewPlatform() directly rather than
// requireRecruiterOrAdmin() — redirect() inside a try/catch in a Route
// Handler would be caught before Next.js can process it as a redirect
// response.
//
// To remove: delete src/app/api/demo/ and src/demo/triggers/.
// ~/lib/sentry-capture and /api/test-sentry-error are core, not
// demo-owned — they keep working unmodified afterward.
//
// apps/nextjs/src/demo/triggers/sentry-payload.ts (buildSyntheticSentryPayload)
// is now unused by this route and should be deleted alongside this change
// — it has no other consumer. Do NOT delete publishSentryJob or anything
// in packages/qstash: those remain fully in use by the real
// /api/webhooks/sentry path this route now relies on.

import { NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";

import { canViewPlatform } from "@dw/auth/roles";
import { rateLimit } from "@dw/redis";
import { createRuntimeContext } from "@dw/runtime/context";

import { getRequestAuthority } from "~/auth/request-authority";
import { isDemoMode } from "~/demo";
import { captureSentryTestError } from "~/lib/sentry-capture";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_REQUESTS = 3;

export async function POST(): Promise<NextResponse> {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authority = await getRequestAuthority().catch(() => null);
  if (!authority || !canViewPlatform(authority.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { redis } = createRuntimeContext();

  try {
    // Global key, not per-user — the resource being protected is shared
    // Sentry event quota, not a per-visitor limit.
    await rateLimit(redis, "global", {
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      prefix: "demo-sentry-trigger",
    });
  } catch (err) {
    const isRateLimited =
      err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS";

    return NextResponse.json(
      {
        error: isRateLimited
          ? "Demo Sentry trigger is rate-limited to protect shared Sentry quota — try again in a few minutes."
          : "Rate limiting service unavailable.",
      },
      { status: isRateLimited ? 429 : 503 },
    );
  }

  try {
    const { testId, sentryEventId } = captureSentryTestError({ demo: true });

    console.log(
      JSON.stringify({
        level: "info",
        demo: "trigger",
        type: "sentry",
        testId,
        sentryEventId,
      }),
    );

    return NextResponse.json({
      ok: true,
      testId,
      sentryEventId,
      note: "Captured via the real Sentry SDK — the incident will appear on the dashboard once Sentry's webhook delivers, typically within a few seconds.",
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        demo: "trigger",
        type: "sentry",
        error: String(err),
      }),
    );
    return NextResponse.json(
      { error: "Failed to capture Sentry event" },
      { status: 500 },
    );
  }
}
