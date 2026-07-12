// packages/auth/src/roles.ts
//
// Role hierarchy for the platform:
//
//   admin     — full access, including toggling demo mode (Doppler var)
//   recruiter — full platform access identical to admin; cannot toggle demo
//               mode (which is not a UI action — it's a Doppler variable)
//   user      — authenticated but no /platform access
//
// The practical difference between admin and recruiter is purely contextual:
// admins own the Doppler config. Recruiters get the same UX on the platform
// dashboard during the demo period. The role name exists so the banner and
// activity logs can distinguish demo sessions from owner sessions.

export const ROLES = {
  ADMIN: "admin",
  RECRUITER: "recruiter",
  USER: "user",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Returns true if the role can access the platform dashboard.
 * Both admin and recruiter have full platform access.
 */
export function canViewPlatform(role: Role | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.RECRUITER;
}

/**
 * Returns true if the role can perform platform actions:
 * resolving incidents, triggering rollbacks, toggling maintenance,
 * running agents, and all other mutations.
 *
 * Both admin and recruiter can mutate — the only thing a recruiter
 * cannot do is toggle demo mode, which is a Doppler variable and
 * has no UI action in the platform.
 */
export function canMutatePlatform(role: Role | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.RECRUITER;
}
