import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function dbEnv() {
  return createEnv({
    server: {
      DATABASE_URL: z.url(),
      DIRECT_URL: z.url(),
      NODE_ENV: z.enum(["development", "test", "production"]).optional(),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
