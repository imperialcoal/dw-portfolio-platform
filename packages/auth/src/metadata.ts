import type { Role } from "./roles";

export interface ClerkPublicMetadata extends Record<string, unknown> {
  role?: Role;
}

// export interface ClerkPrivateMetadata {
//   // future: internal flags, billing ids, etc.
// };

// export interface ClerkUnsafeMetadata {
//   // future: client-writable data
// };

declare global {
  interface CustomJwtSessionClaims {
    metadata: ClerkPublicMetadata;
  }
}

export function getRoleFromClaims(
  claims: CustomJwtSessionClaims | null | undefined,
): Role | undefined {
  return claims?.metadata.role;
}

export {}; // ensures module scope for global augmentation
