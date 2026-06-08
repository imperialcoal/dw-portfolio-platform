import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

/**
 * Admin / owner environment variables.
 *
 * OWNER_EMAILS     — comma-separated emails auto-provisioned as admin on
 *                    first sign-in via the Clerk webhook.
 *
 * RECRUITER_EMAILS — comma-separated emails auto-provisioned as recruiter
 *                    on first sign-in via the Clerk webhook. Demo accounts
 *                    only — set in Doppler stg. Read by src/demo/auth/recruiter-emails.ts
 *                    and injected into the webhook handler via route.ts when
 *                    DEMO_MODE=true. Remove from Doppler when demo mode is retired.
 *
 * DEMO_MODE        — when "true", renders the recruiter-facing DemoHomePage
 *                    and enables demo triggers and recruiter provisioning.
 *                    Set via Doppler stg. No UI toggle exists.
 */
export function authEnv() {
  return createEnv({
    server: {
      OWNER_EMAILS: z.string().min(1).optional(),
      RECRUITER_EMAILS: z.string().optional(),
      DEMO_MODE: z.string().optional(),
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
