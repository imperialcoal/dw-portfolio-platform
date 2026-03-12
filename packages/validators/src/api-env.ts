import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * General API environment variables.
 *
 * Covers: Upstash Redis, Node/App environment detection.
 * Resend variables have moved to messagingEnv() in messaging-env.ts.
 *
 * All values are optional — local/offline development uses Docker Redis
 * via .env.local without needing cloud credentials.
 */
export function apiEnv() {
  return createEnv({
    server: {
      UPSTASH_REDIS_REST_URL: z.url().optional(),
      UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
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
