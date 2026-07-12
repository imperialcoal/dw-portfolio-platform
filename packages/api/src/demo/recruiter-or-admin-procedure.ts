// Builds a tRPC procedure that accepts recruiter OR admin role.
// Constructed by composing protectedProcedure from the core trpc module —
// trpc.ts itself is never modified.
//
// This is the only auth concern the demo module adds to the API package.
//
// To remove demo mode: delete packages/api/src/demo/ and revert post.ts
// to import adminProcedure directly.

import { assertRecruiterOrAdmin } from "@dw/auth";

import { protectedProcedure } from "../trpc";

/**
 * Allows recruiter OR admin role.
 * Used exclusively by post.create when DEMO_MODE=true so recruiters
 * can demonstrate the tRPC post pipeline on /admin.
 */
export const recruiterOrAdminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    assertRecruiterOrAdmin(ctx);
    return next({ ctx });
  },
);
