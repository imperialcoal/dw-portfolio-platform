import type { AuthObject } from "@clerk/backend";

import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";

import type { AuthorityUser } from "./load-authority-user";
import { hasUserId } from "./guards";
import { loadAuthorityUser } from "./load-authority-user";

export interface AuthorityContext {
  userId: string;
  user: AuthorityUser;
}

export async function getAuthorityContext(
  auth: AuthObject,
  db: DbInstance,
  redis: Redis,
): Promise<AuthorityContext> {
  if (!hasUserId(auth)) {
    throw new Error("UNAUTHORIZED");
  }

  const profile = await loadAuthorityUser(auth.userId, db, redis);

  if (!profile || profile.deletedAt) {
    throw new Error("User not found or deleted");
  }

  if (profile.banned) {
    throw new Error("User is banned");
  }

  return {
    userId: auth.userId,
    user: profile,
  };
}
