import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Cron job environment variables.
 *
 * CRON_SECRET is used to authenticate inbound requests to cron endpoints
 * (/api/cron/*). Vercel injects Authorization: Bearer <CRON_SECRET>
 * automatically when invoking cron jobs. We validate it here so callers
 * get a typed, validated value rather than raw process.env access.
 */
export function cronEnv() {
  return createEnv({
    server: {
      CRON_SECRET: z.string().min(32).optional(),
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
