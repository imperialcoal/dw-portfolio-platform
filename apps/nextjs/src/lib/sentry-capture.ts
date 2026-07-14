// Shared Sentry capture helper — core, not demo-owned. Used by both
// /api/test-sentry-error (manual integration smoke test, predates demo
// mode) and /api/demo/trigger/sentry (the demo panel's real round-trip
// trigger). Neither route owns this logic; it lives here so demo mode can
// depend on it without test-sentry-error ever depending on src/demo/.

import * as Sentry from "@sentry/nextjs";

export interface SentryCaptureOptions {
  // Adds a real Sentry tag (demo: "true") and a recognizable message
  // prefix, so demo-triggered issues are trivially filterable in Sentry's
  // own dashboard (sentry.io), separate from real errors — without
  // touching the webhook normalization pipeline (normalizeSentryWebhook)
  // at all, since neither the tag nor the prefix are things it currently
  // parses or needs to.
  demo?: boolean;
}

export interface SentryCaptureResult {
  testId: number;
  sentryEventId: string;
}

/**
 * Captures a synthetic-but-real exception through the actual Sentry SDK —
 * this produces a genuine Sentry event and, once Sentry's configured
 * webhook alert fires, flows through the same real pipeline any production
 * error would (the SDK doesn't distinguish "demo" from "real" at capture
 * time; only the tag/message prefix above do, and only for human/dashboard
 * filtering after the fact).
 */
export function captureSentryTestError(
  opts: SentryCaptureOptions = {},
): SentryCaptureResult {
  const testId = Date.now(); // unique fingerprint per call
  const label = opts.demo ? "[Demo]" : "[Test]";

  const sentryEventId = Sentry.captureException(
    new Error(`${label} Platform agent integration test — ${testId}`),
    opts.demo ? { tags: { demo: "true" } } : undefined,
  );

  return { testId, sentryEventId };
}
