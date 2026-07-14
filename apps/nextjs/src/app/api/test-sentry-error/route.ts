// Manual Sentry integration smoke-test route — captures a genuine
// exception through the real Sentry SDK to confirm error tracking is
// wired correctly end-to-end. GET, no auth guard (matches its original
// scope as a manual dev-facing check, not a public-facing feature).
//
// Not demo-specific. Its core capture logic now lives in
// ~/lib/sentry-capture and is shared with /api/demo/trigger/sentry rather
// than duplicated — this file previously carried a
// "// DELETE THIS FILE AFTER TESTING" comment; that's no longer
// applicable now that the logic it contains has a second, permanent
// consumer.

import { NextResponse } from "next/server";

import { captureSentryTestError } from "~/lib/sentry-capture";

export const runtime = "nodejs";

export function GET(): NextResponse {
  const { testId, sentryEventId } = captureSentryTestError();
  return NextResponse.json({ ok: true, testId, sentryEventId });
}
