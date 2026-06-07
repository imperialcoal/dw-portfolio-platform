// Reads the DEMO_MODE environment variable.
// Set DEMO_MODE=true in Doppler `stg` to enable the recruiter landing page.
// Set to false or remove to restore the base portfolio home.
//
// This is intentionally a plain env check — no Zod, no validator package —
// so the demo module has zero coupling to the core validator infrastructure.

import { env } from "~/env";

export function isDemoMode(): boolean {
  return env.DEMO_MODE === "true";
}
