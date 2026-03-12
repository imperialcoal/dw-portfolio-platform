import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Clerk authentication environment variables.
 *
 * Separated from authEnv() which handles owner/admin config.
 * These are Clerk-specific secrets needed for auth to function.
 *
 * All are optional so local builds work without Clerk credentials
 * (auth routes will simply be non-functional in that case).
 *
 * isClerkConfigured() → safe to initialize Clerk middleware and clients
 */
export function clerkEnv() {
  return createEnv({
    server: {
      CLERK_SECRET_KEY: z.string().min(1).optional(),
      CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
      // Proxy for OAuth redirects in local tunnel dev
      AUTH_REDIRECT_PROXY_URL: z.url().optional(),
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
 * Returns true when Clerk is fully configured for authentication.
 * Auth middleware and protected routes require this to be true.
 */
export function isClerkConfigured(): boolean {
  const env = clerkEnv();
  return !!env.CLERK_SECRET_KEY;
}
