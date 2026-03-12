// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { env } from "~/env";

const isProd = env.NEXT_PUBLIC_APP_ENV === "production";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: isProd
    ? [
        Sentry.replayIntegration({
          // Mask all text and block all media in replay for privacy
          maskAllText: true,
          blockAllMedia: true,
        }),
      ]
    : [],
  // Traces: full sampling in dev/preview, reduced in production
  tracesSampleRate: isProd ? 0.2 : 1.0,

  // Replay: only enabled in production
  replaysSessionSampleRate: isProd ? 0.1 : 0,
  replaysOnErrorSampleRate: isProd ? 1.0 : 0,

  // Enable logs to Sentry
  enableLogs: true,

  // Send PII (email, user ID) with events
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
