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
