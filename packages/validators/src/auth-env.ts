import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      OWNER_EMAILS: z.string().min(1).optional(),
      CLERK_SECRET_KEY: z.string().min(1),
      CLERK_WEBHOOK_SECRET: z.string().min(1),
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
