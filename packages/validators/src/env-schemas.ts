import { z } from "zod";

// ─────────────────────────────────────────────
// Shared schema fragments
//
// These are used as spread inputs to createEnv() in apps/nextjs/src/env.ts
// and other packages that need a subset of the full env shape.
// ─────────────────────────────────────────────

export const nodeEnvSchema = {
  NODE_ENV: z.enum(["development", "test", "production"]),
};

export const appEnvSchema = {
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "test", "preview", "production"]),
  NEXT_PUBLIC_GITHUB_REPO: z
    .string()
    .regex(/^[^/]+\/[^/]+$/)
    .optional(),
};

export const redisSchema = {
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
};

export const databaseSchema = {
  DATABASE_URL: z.url(),
};

// Supabase public (client-side) keys — used in apps/nextjs env.ts client block
export const supabasePublicSchema = {
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1).optional(),
};
