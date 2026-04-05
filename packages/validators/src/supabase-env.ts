// Three distinct Supabase API surfaces, each with its own credentials:
//
//  1. Management API  (api.supabase.com/v1)
//     Token: SUPABASE_ACCESS_TOKEN — Personal Access Token, account-scoped
//     Same token used by Terraform. Needed for:
//       - DB health metrics (table sizes, pooler config)
//       - Security Advisor (RLS warnings, exposed secrets)
//     → isSupabaseConfigured()
//
//  2. PostgREST / Storage API  (project-ref.supabase.co)
//     Token: SUPABASE_SECRET_DEFAULT_KEY — service_role JWT, project-scoped
//     Needed for:
//       - Admin Supabase client (bypasses RLS)
//       - Server-side storage write operations
//     → isSupabaseDbConfigured()
//
//  3. Storage public reads  (project-ref.supabase.co/storage/v1)
//     Token: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY — anon key, public
//     Needed for:
//       - Public file URL resolution
//       - Client-side storage reads
//     → isSupabaseStorageConfigured()

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function supabaseEnv() {
  return createEnv({
    server: {
      // Shared project identifier
      SUPABASE_PROJECT_REF: z.string().min(1).optional(),
      // Management API — Personal Access Token (same as Terraform)
      SUPABASE_ACCESS_TOKEN: z.string().min(1).optional(),
      // PostgREST / Storage admin — service_role JWT
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
 * True when Supabase Management API calls are safe to make.
 * Requires: SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF
 *
 * Used by:
 *   - platform/ai/src/sensors/supabase.ts (fetchDbHealth, fetchSupabaseAdvisories)
 *   - apps/nextjs/src/app/(admin)/platform/database/page.tsx
 *   - apps/nextjs/src/app/api/platform/advisories/sync/route.ts
 */
export function isSupabaseConfigured(): boolean {
  const env = supabaseEnv();
  return !!(env.SUPABASE_ACCESS_TOKEN && env.SUPABASE_PROJECT_REF);
}

/**
 * True when server-side Supabase DB/admin operations are safe to make.
 * Requires: SUPABASE_SECRET_DEFAULT_KEY + SUPABASE_PROJECT_REF
 *
 * Used by:
 *   - apps/nextjs/src/lib/supabase/admin.ts (createAdminClient)
 *   - apps/nextjs/src/lib/supabase/storage.ts (write operations)
 */
export function isSupabaseDbConfigured(): boolean {
  const env = supabaseEnv();
  return !!(env.SUPABASE_PROJECT_REF && env.SUPABASE_SECRET_DEFAULT_KEY);
}

/**
 * True when public Supabase storage reads are safe to make.
 * Requires: SUPABASE_SECRET_DEFAULT_KEY + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
 * (The public URL is validated separately in the client env block of apps/nextjs/src/env.ts)
 *
 * Used by:
 *   - apps/nextjs/src/lib/supabase/storage.ts (public read operations)
 */
export function isSupabaseStorageConfigured(): boolean {
  const env = supabaseEnv();
  // The anon key is client-side — checked via process.env directly since
  // it's validated in the NEXT_PUBLIC block of apps/nextjs/src/env.ts,
  // not in this server-only validator.
  return !!(
    env.SUPABASE_SECRET_DEFAULT_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}
