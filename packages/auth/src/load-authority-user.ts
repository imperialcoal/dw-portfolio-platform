import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";
import { eq } from "@dw/db";
import { user } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

import type { Role } from "./roles";

export interface AuthorityUser {
  id: string;
  role: Role;
  banned: boolean;
  deletedAt: Date | null;
}

export async function loadAuthorityUser(
  userId: string,
  db: DbInstance,
  redis: Redis,
): Promise<AuthorityUser | null> {
  const cacheKey = cacheKeys.userById(userId);

  let profile = await redis.get<AuthorityUser>(cacheKey);

  if (!profile) {
    const dbProfile = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!dbProfile) return null;

    // dbProfile.role is now "admin" | "recruiter" | "user" — matches Role exactly.
    // No cast needed since roleEnum was updated to include "recruiter".
    profile = {
      id: dbProfile.id,
      role: dbProfile.role,
      banned: dbProfile.banned,
      deletedAt: dbProfile.deletedAt,
    };

    await redis.set(cacheKey, profile, { ex: 300 });
  }

  return profile;
}
