import { clerkClient } from "@clerk/nextjs/server";

import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";
import { user } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

import { loadAuthorityUser } from "./load-authority-user";

export async function ensureUserProvisioned(
  userId: string,
  db: DbInstance,
  redis: Redis,
) {
  // Check if user exists in cache or DB first
  const profile = await loadAuthorityUser(userId, db, redis);
  if (profile) return profile;

  // Acquire short lock to prevent provisioning stampede
  const lockKey = `lock:user-provision:${userId}`;
  const acquired = await redis.set(lockKey, "1", { nx: true, ex: 10 });

  if (!acquired) {
    // Another worker is provisioning — wait briefly then retry
    await new Promise((r) => setTimeout(r, 200));
    return loadAuthorityUser(userId, db, redis);
  }

  try {
    let clerkUser;
    try {
      const client = await clerkClient();
      clerkUser = await client.users.getUser(userId);
    } catch {
      // Clerk API unavailable or user not found (e.g. mock key in test env).
      // Return null — caller (getAuthorityContext) converts this to ACCOUNT_UNAVAILABLE.
      return null;
    }

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );

    if (primaryEmail) {
      await db
        .insert(user)
        .values({
          id: clerkUser.id,
          email: primaryEmail.emailAddress,
          emailVerified: primaryEmail.verification?.status === "verified",
          name:
            `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
            null,
          image: clerkUser.imageUrl || null,
          role: "user",
          createdAt: new Date(clerkUser.createdAt),
          updatedAt: new Date(clerkUser.updatedAt),
        })
        .onConflictDoNothing();
    }

    // Defensive cache invalidation
    await redis.del(cacheKeys.userById(userId));

    return loadAuthorityUser(userId, db, redis);
  } finally {
    await redis.del(lockKey);
  }
}
