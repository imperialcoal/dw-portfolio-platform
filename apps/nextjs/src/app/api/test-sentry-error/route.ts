// DELETE THIS FILE AFTER TESTING

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

export function GET(): NextResponse {
  const testId = Date.now(); // unique fingerprint per call
  Sentry.captureException(
    new Error(`[Test] Platform agent integration test — ${testId}`),
  );
  return NextResponse.json({ ok: true, testId });
}
