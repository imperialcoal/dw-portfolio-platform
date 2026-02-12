// import { currentUser } from "@clerk/nextjs/server";

// import type { Role } from "./roles";
// import { ROLES } from "./roles";

// /**
//  * Retrieves the current user or throws if not authenticated.
//  */
// export async function requireUser() {
//   const user = await currentUser();
//   if (!user) {
//     throw new Error("UNAUTHORIZED");
//   }
//   return user;
// }

// /**
//  * Checks if the current user has a specific role.
//  */
// export async function requireRole(role: Role) {
//   const user = await requireUser();
//   const userRole = user.publicMetadata.role as Role | undefined;

//   if (userRole !== role) {
//     throw new Error("FORBIDDEN");
//   }
//   return user;
// }

// /**
//  * Specific check for Admin status
//  */
// export async function requireAdmin() {
//   return requireRole(ROLES.ADMIN);
// }

// /**
//  * Checks if a user is not banned (Example implementation)
//  */
// export async function requireNotBanned() {
//   const user = await requireUser();
//   // Assuming you might add a 'banned' boolean to metadata later
//   const isBanned = user.publicMetadata.banned === true;

//   if (isBanned) {
//     throw new Error("USER_BANNED");
//   }
//   return user;
// }

// packages/auth/src/rbac.ts

import { TRPCError } from "@trpc/server";

import type { Role } from "./roles";
import { ROLES } from "./roles";

export interface RBACUser {
  id: string;
  role: Role;
  banned?: boolean;
  deletedAt?: Date | null;
}

export interface RBACContext {
  user?: RBACUser | null;
}

/**
 * Require authenticated user
 */
export function assertUser(ctx: RBACContext): asserts ctx is {
  user: RBACUser;
} {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
}

/**
 * Require specific role
 */
export function assertRole(
  ctx: RBACContext,
  role: Role,
): asserts ctx is { user: RBACUser & { role: Role } } {
  assertUser(ctx);

  if (ctx.user.role !== role) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not authorized to perform this action.",
    });
  }
}

/**
 * Require admin
 */
export function assertAdmin(ctx: RBACContext) {
  assertRole(ctx, ROLES.ADMIN);
}

/**
 * Require not banned
 */
export function assertNotBanned(ctx: RBACContext) {
  assertUser(ctx);

  if (ctx.user.banned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is banned",
    });
  }
}
