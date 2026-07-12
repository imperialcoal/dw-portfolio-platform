// Reads RECRUITER_EMAILS from Doppler config and returns a trimmed array.
// Imported by apps/nextjs/src/app/api/webhooks/clerk/route.ts when
// DEMO_MODE=true to inject recruiter auto-provisioning into the webhook handler.
//
// The handler itself (handler.ts) has no knowledge of this file, DEMO_MODE,
// or RECRUITER_EMAILS — it accepts recruiterEmails as a generic optional
// injection via ClerkWebhookDeps. This file is the only seam.
//
// To remove demo mode:
//   - Delete src/demo/
//   - In route.ts, remove the isDemoMode() conditional and this import
//   - Remove RECRUITER_EMAILS from Doppler stg

import { env } from "~/env";

/**
 * Returns the list of emails that should be auto-provisioned as recruiter
 * on Clerk webhook events. Sourced from RECRUITER_EMAILS in Doppler stg.
 *
 * Returns an empty array if the variable is not set.
 */
export function getRecruiterEmails(): string[] {
  const raw = env.RECRUITER_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
