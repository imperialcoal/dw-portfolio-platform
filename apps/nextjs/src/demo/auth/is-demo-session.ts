// Returns true only when DEMO_MODE=true AND the current session is a recruiter.
// Admins always get false — they retain full access to deep links and all
// platform functionality regardless of the Doppler DEMO_MODE flag.
//
// Used by platform pages to compute isDemo for DemoDeepLink.
// getRequestAuthority() is React-cached so this is a free call.
//
// To remove demo mode: delete src/demo/ and remove all isDemo references.

import { ROLES } from "@dw/auth";

import { getRequestAuthority } from "~/auth/request-authority";
import { isDemoMode } from "~/demo/is-demo-mode";

export async function isDemoSession(): Promise<boolean> {
  if (!isDemoMode()) return false;
  const authority = await getRequestAuthority();
  return authority.user.role === ROLES.RECRUITER;
}
