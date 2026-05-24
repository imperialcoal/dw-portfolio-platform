// Role hierarchy for the platform:
//   admin  — full access, including destructive actions (resolve, rollback, maintenance)
//   viewer — read-only access to /platform/* pages (for recruiter demo accounts)
//   user   — authenticated but no platform access

export const ROLES = {
  ADMIN: "admin",
  VIEWER: "viewer",
  USER: "user",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Returns true if the role can read the platform dashboard.
 * Viewers and admins can both browse — only admins can mutate.
 */
export function canViewPlatform(role: Role | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.VIEWER;
}

/**
 * Returns true if the role can perform destructive platform actions:
 * resolving incidents, triggering rollbacks, toggling maintenance mode.
 */
export function canMutatePlatform(role: Role | undefined): boolean {
  return role === ROLES.ADMIN;
}
