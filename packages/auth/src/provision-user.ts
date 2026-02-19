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
  // Check if user exists
  const profile = await loadAuthorityUser(userId, db, redis);
  if (profile) return profile;

  // acquire short lock to prevent provisioning stampede
  const lockKey = `lock:user-provision:${userId}`;
  const acquired = await redis.set(lockKey, "1", { nx: true, ex: 10 });

  if (!acquired) {
    // another worker is provisioning — wait briefly then retry
    await new Promise((r) => setTimeout(r, 200));
    return loadAuthorityUser(userId, db, redis);
  }

  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

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
          role: "user", // default role; role sync handled separately
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
