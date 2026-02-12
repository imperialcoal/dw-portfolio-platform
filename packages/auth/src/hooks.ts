"use client";

import { useUser } from "@clerk/nextjs";

import type { ClerkPublicMetadata } from "./metadata";
import type { Role } from "./roles";
import { ROLES } from "./roles";

export function useUserRole(): Role | undefined {
  const { user } = useUser();
  const metadata = user?.publicMetadata as ClerkPublicMetadata | undefined;
  return metadata?.role;
}

export function useIsAdmin(): boolean {
  return useUserRole() === ROLES.ADMIN;
}

export function useIsUser(): boolean {
  return useUserRole() === ROLES.USER;
}

export function useIsAuthenticated(): boolean {
  const { isSignedIn } = useUser();
  return Boolean(isSignedIn);
}
