import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Observability environment variables.
 *
 * Covers two concerns:
 *
 * 1. Sentry — used at build time (source maps) AND at runtime by
 *    platform/ai/sensors/sentry.ts for polling issues via Sentry REST API.
 *    SENTRY_AUTH_TOKEN is build-only (Vercel/CI). SENTRY_ORG and SENTRY_PROJECT
 *    are needed both at build and by the sensor at runtime.
 *
 * 2. Vercel API — used by platform/ai/sensors/vercel.ts to fetch deployment
 *    history for the platform dashboard correlation view.
 *    VERCEL_API_TOKEN is secret (not injected by Vercel itself).
 *    VERCEL_PROJECT_ID is the project identifier for API calls.
 *
 * All values are optional — sensors degrade gracefully when absent.
 *
 * isSentryApiConfigured()  → safe to call Sentry REST API (sensors)
 * isVercelApiConfigured()  → safe to call Vercel API (sensors)
 */
export function observabilityEnv() {
  return createEnv({
    server: {
      // Sentry — build & source map upload (CI/Vercel build step)
      SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
      // Sentry — runtime sensor (platform/ai/sensors/sentry.ts polls these)
      SENTRY_ORG: z.string().min(1).optional(),
      SENTRY_PROJECT: z.string().min(1).optional(),
      SENTRY_TOKEN: z.string().min(1).optional(),
      // Vercel API — runtime sensor (platform/ai/sensors/vercel.ts)
      VERCEL_API_TOKEN: z.string().min(1).optional(),
      VERCEL_PROJECT_ID: z.string().min(1).optional(),
      VERCEL_TEAM_ID: z.string().min(1).optional(),
      // Custom domain alias used for rollback alias reassignment
      // Preview: dev.dw-portfolio.dev  |  Production: dw-portfolio.dev
      VERCEL_DOMAIN: z.string().min(1).optional(),
      VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      APP_ENV: z
        .enum(["local", "test", "preview", "production"])
        .default("local"),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}

/**
 * Returns true when the Sentry REST API can be called.
 * Requires SENTRY_ORG, SENTRY_PROJECT, and SENTRY_TOKEN (a separate
 * auth token for API access — distinct from SENTRY_AUTH_TOKEN which
 * is only used for source map uploads during build).
 */
export function isSentryApiConfigured(): boolean {
  const env = observabilityEnv();
  return !!(env.SENTRY_ORG && env.SENTRY_PROJECT && env.SENTRY_TOKEN);
}

/**
 * Returns true when Vercel deployment data can be fetched.
 * Without this, the /platform/deployments dashboard page shows an empty state
 * rather than crashing.
 */
export function isVercelApiConfigured(): boolean {
  const env = observabilityEnv();
  return !!(env.VERCEL_API_TOKEN && env.VERCEL_PROJECT_ID);
}
