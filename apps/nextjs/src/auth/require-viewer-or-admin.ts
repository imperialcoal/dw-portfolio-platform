// Guard for /platform/* read-only pages.
// Allows both admin and viewer roles; redirects all others to /.
//
// Usage — drop-in replacement for requireAdmin() on read pages:
//
//   const authority = await requireViewerOrAdmin();
//   const isReadOnly = authority.user.role === ROLES.VIEWER;
//
// Destructive pages (resolve, rollback, maintenance) keep requireAdmin().

import { redirect } from "next/navigation";

import { ROLES } from "@dw/auth";
import { canViewPlatform } from "@dw/auth/roles";

import { getRequestAuthority } from "./request-authority";

export async function requireViewerOrAdmin() {
  const authority = await getRequestAuthority();

  if (!canViewPlatform(authority.user.role)) {
    redirect("/");
  }

  return authority;
}

/**
 * Convenience: returns true when the current session is a viewer (read-only).
 * Use this in Server Components to conditionally hide action buttons.
 *
 * Example:
 *   const { isReadOnly } = await getPlatformAccessLevel();
 *   {!isReadOnly && <ResolveButton />}
 */
export async function getPlatformAccessLevel() {
  const authority = await getRequestAuthority();
  const role = authority.user.role;

  if (!canViewPlatform(role)) {
    redirect("/");
  }

  return {
    authority,
    isReadOnly: role === ROLES.VIEWER,
    isAdmin: role === ROLES.ADMIN,
  };
}
