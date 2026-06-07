// packages/auth/src/rbac.ts

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
 * Require admin role (owner-only actions — not needed for recruiter).
 * Currently unused in platform routes since recruiters have full access.
 * Reserved for future owner-only features (e.g., billing, Doppler config).
 */
export function assertAdmin(ctx: RBACContext) {
  assertRole(ctx, ROLES.ADMIN);
}

/**
 * Require recruiter OR admin role (platform access).
 * Use this on all /platform/* pages and API routes.
 *
 * Both roles have identical platform capabilities.
 * The distinction is only in the session banner and activity logs.
 */
export function assertRecruiterOrAdmin(ctx: RBACContext) {
  assertUser(ctx);
  if (!canViewPlatform(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not authorized to view the platform dashboard.",
    });
  }
}

/**
 * Require platform mutation access (recruiter or admin).
 * Both roles can resolve incidents, trigger rollbacks, toggle maintenance,
 * and run platform agents. There are no recruiter-restricted mutations.
 */
export function assertPlatformMutator(ctx: RBACContext) {
  assertUser(ctx);
  if (!canMutatePlatform(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform access required.",
    });
  }
}

/**
 * Require not banned.
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
