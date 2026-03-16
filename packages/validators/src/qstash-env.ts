import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * QStash environment variables.
 */

export function qstashEnv() {
  return createEnv({
    server: {
      QSTASH_URL: z.url().optional(),
      QSTASH_TOKEN: z.string().min(1).optional(),
      QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
      QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
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

export function isQStashConfigured(): boolean {
  const env = qstashEnv();
  return !!(env.QSTASH_URL && env.QSTASH_TOKEN);
}
