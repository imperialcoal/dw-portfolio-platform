import type { AuthorityUser, ClerkPublicMetadata, Role } from "@dw/auth";
import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";
import { ROLES } from "@dw/auth";
import { eq } from "@dw/db";
import { user } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

import type { WebhookEvent } from "~/auth/server";

export type SupportedClerkEvents = Extract<
  WebhookEvent,
  { type: "user.created" | "user.updated" | "user.deleted" }
>;

interface ClerkWebhookDeps {
  db: DbInstance;
  redis: Redis;
  clerk: {
    updateUserMetadata: (
      userId: string,
      data: {
        publicMetadata?: ClerkPublicMetadata;
      },
    ) => Promise<void>;
  };
  ensureUserProvisioned: (
    userId: string,
    db: DbInstance,
    redis: Redis,
  ) => Promise<AuthorityUser | null>;
  ownerEmails: string[];
}

export async function handleClerkWebhook(
  evt: SupportedClerkEvents,
  deps: ClerkWebhookDeps,
) {
  const { db, redis, clerk, ensureUserProvisioned, ownerEmails } = deps;
  const { type } = evt;

  switch (type) {
    case "user.created":
    case "user.updated": {
      const data = evt.data;

      if (!data.id) {
        throw new Error("Missing user id");
      }

      const provisioned = await ensureUserProvisioned(data.id, db, redis);

      if (!provisioned) {
        throw new Error("Failed to provision user");
      }

      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id,
      );

      if (!primaryEmail) {
        throw new Error("Missing email");
      }

      const isOwner = ownerEmails.includes(primaryEmail.email_address);
      const role: Role = isOwner ? ROLES.ADMIN : ROLES.USER;

      await db
        .insert(user)
        .values({
          id: data.id,
          email: primaryEmail.email_address,
          emailVerified: primaryEmail.verification?.status === "verified",
          name:
            `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
          image: data.image_url || null,
          role,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        })
        .onConflictDoUpdate({
          target: user.id,
          set: {
            role,
            email: primaryEmail.email_address,
            emailVerified: primaryEmail.verification?.status === "verified",
            name:
              `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
            image: data.image_url || null,
            updatedAt: new Date(data.updated_at),
          },
        });

      const dbUser = await db.query.user.findFirst({
        where: eq(user.id, data.id),
        columns: { role: true },
      });

      const metadata = data.public_metadata as ClerkPublicMetadata;
      const clerkRole = metadata.role;

      if (dbUser && clerkRole !== dbUser.role) {
        const lockKey = `lock:user-role-sync:${data.id}`;
        const acquired = await redis.set(lockKey, "1", {
          nx: true,
          ex: 15,
        });

        if (acquired) {
          try {
            await clerk.updateUserMetadata(data.id, {
              publicMetadata: { role: dbUser.role },
            });
          } finally {
            await redis.del(lockKey);
          }
        }
      }

      await redis.del(cacheKeys.userById(data.id));
      return;
    }

    case "user.deleted": {
      const data = evt.data;

      if (!data.id) {
        throw new Error("Missing user id");
      }

      await db
        .update(user)
        .set({ deletedAt: new Date() })
        .where(eq(user.id, data.id));

      await redis.del(cacheKeys.userById(data.id));
      return;
    }

    default:
      return;
  }
}
