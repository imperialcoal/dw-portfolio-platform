import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

/**
 * Resume Generator service environment variables.
 *
 * RESUME_API_URL — base URL of the Go resume-api service (Railway deployment).
 *                  e.g. https://dw-resume-api-production.up.railway.app
 *                  Optional so local/CI builds don't fail when the service
 *                  isn't configured — the resume route fails gracefully at
 *                  call time instead of at build/validation time.
 *
 * RESUME_API_KEY — shared secret sent as X-API-Key to the resume-api service.
 *                  Optional — if unset, the Go service runs with auth disabled
 *                  (acceptable for early local dev, not for deployed environments).
 *
 * Follows the same per-domain validator pattern as clerk-env.ts, qstash-env.ts,
 * redis-env.ts, etc. — composed into apps/nextjs/src/env.ts via `extends`.
 */
export function resumeEnv() {
  return createEnv({
    server: {
      RESUME_API_URL: z.url().optional(),
      RESUME_API_KEY: z.string().min(1).optional(),
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
 * Returns true when the resume-api service is configured and reachable.
 * Use this to conditionally render the resume generator UI / guard the route.
 */
export function isResumeApiConfigured(): boolean {
  const env = resumeEnv();
  return !!env.RESUME_API_URL;
}
