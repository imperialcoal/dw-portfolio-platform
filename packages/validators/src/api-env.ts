import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function apiEnv() {
  return createEnv({
    server: {
      UPSTASH_REDIS_REST_URL: z.url(),
      UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
