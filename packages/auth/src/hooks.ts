"use client";

import { useUser } from "@clerk/nextjs";

import type { ClerkPublicMetadata } from "./metadata";
import type { Role } from "./roles";
import { ROLES } from "./roles";

function isClerkPublicMetadata(v: unknown): v is ClerkPublicMetadata {
  return (
    v !== null &&
    typeof v === "object" &&
    "role" in v &&
    typeof (v as Record<string, unknown>).role === "string"
  );
}

export function useUserRole(): Role | undefined {
  const { user } = useUser();
  const meta = user?.publicMetadata;
  return isClerkPublicMetadata(meta) ? meta.role : undefined;
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
