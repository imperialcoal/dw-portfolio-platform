import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";

import type { AuthObject } from "./guards";
import type { AuthorityUser } from "./load-authority-user";
import { AUTH_ERRORS } from "./errors";
import { hasUserId } from "./guards";
import { ensureUserProvisioned } from "./provision-user";

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
    throw AUTH_ERRORS.UNAUTHORIZED();
  }

  // Provision the user if missing
  const profile = await ensureUserProvisioned(auth.userId, db, redis);

  if (!profile || profile.deletedAt) {
    throw AUTH_ERRORS.ACCOUNT_UNAVAILABLE();
  }

  if (profile.banned) {
    throw AUTH_ERRORS.BANNED();
  }

  return {
    userId: auth.userId,
    user: profile,
  };
}
