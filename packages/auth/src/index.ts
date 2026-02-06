export { clerkConfig, type ClerkAuth, type ClerkUser } from "./clerk";

export { authEnv } from "../env";

export { ROLES, type Role } from "./roles";

export {
  requireUser,
  requireRole,
  requireAdmin,
  requireNotBanned,
} from "./rbac";

export type {
  ClerkPublicMetadata,
  // For future use
  // ClerkPrivateMetadata,
  // ClerkUnsafeMetadata,
  getRoleFromClaims,
} from "./metadata";
