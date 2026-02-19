import type { NextRequest } from "next/server";

import type { AuthorityContext } from "@dw/auth/context";
import type { AuthObject } from "@dw/auth/guards";
import type { Role } from "@dw/auth/roles";
import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";
import { getAuthorityContext } from "@dw/auth/context";

export interface WithAuthorityOptions {
  role?: Role;
}

/**
 * Wrap any handler to enforce:
 * 1. Provisioned user
 * 2. Authority checks
 * 3. Role enforcement
 */
export function withAuthority(
  handler: (
    ctx: {
      auth: AuthObject;
      authority: AuthorityContext;
      db: DbInstance;
      redis: Redis;
    },
    req: NextRequest,
  ) => Promise<Response>,
  options?: WithAuthorityOptions,
) {
  return async (
    auth: AuthObject,
    db: DbInstance,
    redis: Redis,
    req: NextRequest,
  ) => {
    // Step 1: Ensure user exists & fetch profile
    const authority = await getAuthorityContext(auth, db, redis);

    // Step 2: Enforce role if specified
    if (options?.role && authority.user.role !== options.role) {
      return new Response("Forbidden", { status: 403 });
    }

    // Step 3: Call actual handler
    return handler({ auth, authority, db, redis }, req);
  };
}
