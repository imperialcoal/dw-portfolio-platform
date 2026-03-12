import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

/**
 * Admin / owner environment variables.
 *
 * OWNER_EMAILS — comma-separated list of email addresses that have full
 * admin privileges. Used by auth guards to determine who is an admin,
 * and mirrors RESEND_TO_EMAIL for incident email routing.
 *
 */
export function authEnv() {
  return createEnv({
    server: {
      OWNER_EMAILS: z.string().min(1).optional(),
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
