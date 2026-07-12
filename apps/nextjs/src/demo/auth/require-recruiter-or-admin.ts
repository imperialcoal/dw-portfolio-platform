// apps/nextjs/src/auth/require-recruiter-or-admin.ts
//
// Guard for /platform/* pages.
// Allows both admin and recruiter roles; redirects all others to /.
//
// Replaces require-viewer-or-admin.ts — keep that file as a re-export
// shim during migration to avoid touching every import site at once.
//
// Usage:
//   const { isRecruiter } = await getPlatformAccessLevel();
//
// The platform UI does not gate any actions based on isRecruiter —
// recruiters have identical capabilities to admins on the platform.
// isRecruiter is only used for the session banner in platform/layout.tsx.

import { redirect } from "next/navigation";

import { ROLES } from "@dw/auth";
import { canViewPlatform } from "@dw/auth/roles";

import { getRequestAuthority } from "../../auth/request-authority";

export async function requireRecruiterOrAdmin() {
  const authority = await getRequestAuthority();

  if (!canViewPlatform(authority.user.role)) {
    redirect("/");
  }

  return authority;
}

/**
 * Returns access level for the current session.
 * isRecruiter is true when the session is a demo/recruiter account.
 * Used only for the banner in platform/layout.tsx — not for gating actions.
 */
export async function getPlatformAccessLevel() {
  const authority = await getRequestAuthority();
  const role = authority.user.role;

  if (!canViewPlatform(role)) {
    redirect("/");
  }

  return {
    authority,
    isRecruiter: role === ROLES.RECRUITER,
    isAdmin: role === ROLES.ADMIN,
    // Legacy alias — remove once all pages use isRecruiter
    isReadOnly: role === ROLES.RECRUITER,
  };
}
