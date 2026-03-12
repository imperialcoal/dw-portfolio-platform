import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Messaging environment variables.
 *
 * All Resend-related configuration lives here.
 * All values are optional so local/offline development
 * (Docker only, no cloud services) doesn't crash the app.
 *
 * Env var   →  Purpose
 * ───────────────────────────────────────────────────────────────
 * RESEND_API_KEY            ← Resend API credentials
 * RESEND_FROM_EMAIL         ← contact@dw-portfolio.dev (contact form sender)
 * RESEND_AGENT_FROM_EMAIL   ← agent@dw-portfolio.dev (platform agent sender)
 * RESEND_TO_EMAIL           ← Where contact form emails land (mirrors OWNER_EMAILS)
 */
export function messagingEnv() {
  return createEnv({
    server: {
      RESEND_API_KEY: z.string().min(1).optional(),
      RESEND_FROM_EMAIL: z.email().optional(),
      RESEND_AGENT_FROM_EMAIL: z.email().optional(),
      RESEND_TO_EMAIL: z.email().optional(),
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
 * Returns true only when all required Resend vars are present.
 * Used as a guard before calling Resend APIs so the app degrades
 * gracefully in local/offline development instead of throwing.
 */
export function isMessagingConfigured(): boolean {
  const env = messagingEnv();
  return !!(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL && env.RESEND_TO_EMAIL);
}

/**
 * Returns true only when the agent email sender is configured.
 * The agent sender (RESEND_AGENT_FROM_EMAIL) is separate from the
 * contact form sender — it won't be set in local dev.
 */
export function isAgentEmailConfigured(): boolean {
  const env = messagingEnv();
  return !!(env.RESEND_API_KEY && env.RESEND_AGENT_FROM_EMAIL);
}
