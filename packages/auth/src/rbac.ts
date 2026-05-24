import { TRPCError } from "@trpc/server";

import type { Role } from "./roles";
import { canMutatePlatform, canViewPlatform, ROLES } from "./roles";

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
 * Require authenticated user (any role).
 */
export function assertUser(ctx: RBACContext): asserts ctx is {
  user: RBACUser;
} {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
}

/**
 * Require specific role (exact match).
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
 * Require admin role (full platform access + destructive actions).
 */
export function assertAdmin(ctx: RBACContext) {
  assertRole(ctx, ROLES.ADMIN);
}

/**
 * Require viewer OR admin role (read-only platform access).
 * Use this on all /platform/* pages except destructive endpoints.
 */
export function assertViewerOrAdmin(ctx: RBACContext) {
  assertUser(ctx);
  if (!canViewPlatform(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not authorized to view the platform dashboard.",
    });
  }
}

/**
 * Require admin for mutations (resolve, rollback, maintenance toggle).
 * Throws FORBIDDEN for viewers with a clear message so the UI can display it.
 */
export function assertPlatformMutator(ctx: RBACContext) {
  assertUser(ctx);
  if (!canMutatePlatform(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "This action requires admin access. You are viewing in read-only mode.",
    });
  }
}

/**
 * Require not banned (used as an additional check after role assertions).
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
