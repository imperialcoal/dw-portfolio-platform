import { eq } from "drizzle-orm";

import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";
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
  // Try to get user from Redis cache first
  const cacheKey = cacheKeys.userById(userId);

  let profile = await redis.get<AuthorityUser>(cacheKey);

  // If not in cache, load from DB
  if (!profile) {
    const dbProfile = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    // Convert undefined to null for consistency
    if (!dbProfile) return null;

    profile = {
      id: dbProfile.id,
      role: dbProfile.role as Role,
      banned: dbProfile.banned,
      deletedAt: dbProfile.deletedAt,
    };

    // Future consideration:
    // If a user signs up and immediately gets redirected to the dashboard,
    // there is a tiny chance the webhook hasn't finished writing to Postgres yet.
    // --- JIT (Just-In-Time) FALLBACK START ---
    // If DB missed the webhook, fetch from Clerk directly and insert NOW.
    // Insert basic record so the user isn't blocked
    // Default to "user" role safely
    // --- JIT FALLBACK END ---

    // Cache the user profile if found (5 min TTL)
    await redis.set(cacheKey, profile, { ex: 300 });
  }

  return profile;
}
