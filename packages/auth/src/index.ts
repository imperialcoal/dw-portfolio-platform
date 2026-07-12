export { clerkConfig, type ClerkAuth, type ClerkUser } from "./clerk";

export type { Role } from "./roles";
export { ROLES, canViewPlatform, canMutatePlatform } from "./roles";

// export {
//   requireUser,
//   requireRole,
//   requireAdmin,
//   requireNotBanned,
// } from "./rbac";

export {
  assertUser,
  assertRole,
  assertAdmin,
  assertRecruiterOrAdmin,
  assertPlatformMutator,
  assertNotBanned,
} from "./rbac";
export type { RBACUser, RBACContext } from "./rbac";

export { loadAuthorityUser } from "./load-authority-user";
export type { AuthorityUser } from "./load-authority-user";

export { getAuthorityContext } from "./context";
export type { AuthorityContext } from "./context";

export { hasUserId } from "./guards";
export type { AuthObject } from "./guards";

export { AUTH_ERRORS } from "./errors";
export type { AuthErrorFactory } from "./errors";

export type {
  ClerkPublicMetadata,
  // For future use
  // ClerkPrivateMetadata,
  // ClerkUnsafeMetadata,
  getRoleFromClaims,
} from "./metadata";

export { ensureUserProvisioned } from "./provision-user";
