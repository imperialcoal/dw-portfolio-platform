import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Upstash Redis environment variables.
 *
 * Optional so local Docker Redis can be used instead.
 */

export function redisEnv() {
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

/**
 * Returns true when Upstash Redis is configured.
 * False in local Docker dev when using the local Upstash-compatible server.
 * Both cloud and local Docker work — this guards against missing vars entirely.
 */
export function isRedisConfigured(): boolean {
  const env = redisEnv();
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
