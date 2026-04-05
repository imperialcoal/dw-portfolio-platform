import { createClient } from "@supabase/supabase-js";

import { isSupabaseDbConfigured } from "@dw/validators";

import { env } from "~/env";

// Admin client bypasses RLS — server-only, never expose to client
// Used for all storage write/delete operations (admin only)
export function createAdminClient() {
  if (!isSupabaseDbConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_DEFAULT_KEY to enable storage features.",
    );
  }

  const url = String(env.NEXT_PUBLIC_SUPABASE_URL);
  const key = String(env.SUPABASE_SECRET_DEFAULT_KEY);

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
