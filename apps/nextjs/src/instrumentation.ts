import * as Sentry from "@sentry/nextjs";

export async function register() {
  // variable injected by the framework and cannot be accessed via ~/env
  // eslint-disable-next-line no-restricted-properties -- NEXT_RUNTIME is a Next.js internal
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  // variable injected by the framework and cannot be accessed via ~/env
  // eslint-disable-next-line no-restricted-properties -- NEXT_RUNTIME is a Next.js internal
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
