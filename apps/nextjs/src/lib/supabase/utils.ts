import { env } from "~/env";

// The key design decisions here are that isSupabaseConfigured() and isStorageAvailable() are exported
// so call sites — tRPC procedures, server actions, UI components — can check availability
// before attempting operations and render appropriate fallback states rather than crashing.

// And the error messages are explicit about exactly which env vars are missing,
// which makes debugging during onboarding or local development straightforward.

// At call sites the pattern looks like:
/** 
  typescriptimport { isStorageAvailable, uploadFile } from "~/lib/supabase/storage";

  // In a server action or tRPC procedure
  if (!isStorageAvailable()) {
    // Either skip gracefully or inform the user storage isn't configured
    return { error: "Storage not available in this environment" };
  }

  await uploadFile(STORAGE_BUCKETS.PORTFOLIO, path, file);
*/

// This way the bare minimum local environment boots and runs
// without any Supabase vars set, storage-dependent UI can conditionally render based on isStorageAvailable(),
// and when Supabase is configured the full feature set is available.

export function isSupabaseConfigured(): boolean {
  return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_DEFAULT_KEY);
}

export function isStorageAvailable(): boolean {
  return (
    isSupabaseConfigured() && !!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  );
}
