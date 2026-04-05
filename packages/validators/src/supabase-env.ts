import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Supabase environment variables used at runtime.
 *
 * Supabase vars split into two tiers:
 *
 * 1. Connection (required in deployed envs, absent in local Docker dev):
 *    SUPABASE_PROJECT_REF, SUPABASE_SECRET_DEFAULT_KEY
 *
 * 2. Public keys (also in apps/nextjs/src/env.ts as NEXT_PUBLIC_*):
 *    These are validated client-side — not repeated here to avoid duplication.
 *
 * isSupabaseConfigured() → safe to make Supabase API calls
 */
export function supabaseEnv() {
  return createEnv({
    server: {
      // Supabase Management API — for DB health and security advisories
      SUPABASE_PROJECT_REF: z.string().min(1).optional(),
      SUPABASE_MANAGEMENT_TOKEN: z.string().min(1).optional(),
      SUPABASE_SECRET_DEFAULT_KEY: z.string().min(1).optional(),
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
 * Returns true when Supabase API credentials are available.
 * False in local Docker dev — use the DB directly via DATABASE_URL instead.
 */
export function isSupabaseConfigured(): boolean {
  const env = supabaseEnv();
  return !!(env.SUPABASE_PROJECT_REF && env.SUPABASE_SECRET_DEFAULT_KEY);
}
