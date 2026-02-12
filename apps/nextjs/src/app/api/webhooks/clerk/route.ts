import type { WebhookEvent } from "@clerk/backend";
import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";

import type { ClerkPublicMetadata, Role } from "@dw/auth";
import { config } from "@dw/config";
import { user } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";
import { bootstrapInfra } from "@dw/runtime/bootstrap";
import { createRuntimeContext } from "@dw/runtime/context";

export async function POST(req: Request) {
  if (config.app.APP_ENV !== "production") {
    await bootstrapInfra(); // optional: verifies local dev infra
  }

  const { db, redis } = createRuntimeContext();
  const WEBHOOK_SECRET = config.auth.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  // Get headers
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // Validate headers
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Error: Missing svix headers", { status: 400 });
  }

  // Get body
  const payload = await req.text();

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error: Verification failed", { status: 400 });
  }

  // Handle events
  const { type, data } = evt;

  try {
    switch (type) {
      case "user.created": {
        const primaryEmail = data.email_addresses.find(
          (e) => e.id === data.primary_email_address_id,
        );

        if (!primaryEmail) {
          return new Response("Error: Missing email", { status: 400 });
        }

        const ownerEmails = config.auth.OWNER_EMAILS?.split(",") ?? [];
        const isOwner = ownerEmails.includes(primaryEmail.email_address);

        const role = isOwner ? "admin" : "user";

        await db
          .insert(user)
          .values({
            id: data.id,
            email: primaryEmail.email_address,
            emailVerified: primaryEmail.verification?.status === "verified",
            name:
              `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
            image: data.image_url || null,
            role: role,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
          })
          .onConflictDoNothing();

        // Cache the newly created user
        const newUser = await db.query.user.findFirst({
          where: eq(user.id, data.id),
        });

        if (newUser) {
          void redis.set(cacheKeys.userById(data.id), newUser, { ex: 300 });
        }

        console.log(`✅ User created: ${data.id}`);
        break;
      }

      case "user.updated": {
        const primaryEmail = data.email_addresses.find(
          (e) => e.id === data.primary_email_address_id,
        );

        if (!primaryEmail) {
          return new Response("Error: Missing email", { status: 400 });
        }

        const ownerEmails = config.auth.OWNER_EMAILS?.split(",") ?? [];
        const isOwner = ownerEmails.includes(primaryEmail.email_address);

        const role = isOwner ? "admin" : "user";

        // 1. UPSERT (Avoid Race Condition)
        // If the user doesn't exist (missed 'user.created'), create them.
        // If they do exist, update them.
        // CRITICAL: Do NOT include 'role' in the update set. DB role persists.
        // This condition isOwner only exists for now while owners are the only real users, everyone else is a guest
        if (isOwner) {
          await db
            .insert(user)
            .values({
              id: data.id,
              email: primaryEmail.email_address,
              emailVerified: primaryEmail.verification?.status === "verified",
              name:
                `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() ||
                null,
              image: data.image_url || null,
              role: role,
              createdAt: new Date(data.created_at),
              updatedAt: new Date(data.updated_at),
            })
            .onConflictDoUpdate({
              target: user.id,
              set: {
                email: primaryEmail.email_address,
                emailVerified: primaryEmail.verification?.status === "verified",
                name:
                  `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() ||
                  null,
                image: data.image_url || null,
                updatedAt: new Date(data.updated_at),
                // NO ROLE UPDATE HERE -> Preserves existing DB role
              },
            });
        }

        // 2. Fetch the "Source of Truth"
        // Fetch strictly the role to minimize data transfer
        const dbUser = await db.query.user.findFirst({
          where: eq(user.id, data.id),
          columns: { role: true },
        });

        // 3. Anti-Recursion Back-Sync
        // Only call Clerk if there is a strict mismatch.
        // This breaks the loop: Clerk updates -> Webhook fires -> Roles match -> Stop.
        const metadata = data.public_metadata as ClerkPublicMetadata;
        const clerkRole = metadata.role;

        if (dbUser && clerkRole !== dbUser.role) {
          // Distributed lock: prevents multiple webhook workers syncing simultaneously
          const lockKey = `lock:user-role-sync:${data.id}`;
          const acquired = await redis.set(lockKey, "1", { nx: true, ex: 15 });
          if (!acquired) return new Response("OK");

          try {
            // Optimistic concurrency guard: re-read the role once more and prevent stale read overwriting newer DB changes
            const latest = await db.query.user.findFirst({
              where: eq(user.id, data.id),
              columns: { role: true },
            });

            const dbRole = dbUser.role as Role | undefined; // Type assertion safe due to DB schema
            const latestRole = latest?.role as Role | undefined;

            if (!latest || latestRole !== dbRole) return;

            const client = await clerkClient();

            await client.users.updateUserMetadata(data.id, {
              publicMetadata: {
                role: latestRole,
              },
            });

            console.log(
              `🔄 Synced Role: Clerk (${clerkRole}) -> DB (${latestRole})`,
            );
          } finally {
            // ALWAYS release the lock even if an error occurs
            await redis.del(lockKey);
          }
        }

        // 4. Invalidate Cache
        void redis.del(cacheKeys.userById(data.id));

        console.log(`✅ User updated: ${data.id}`);
        break;
      }

      case "user.deleted": {
        if (!data.id) {
          return new Response("Error: Missing user ID", { status: 400 });
        }

        await db
          .update(user)
          .set({ deletedAt: new Date() })
          .where(eq(user.id, data.id));

        // Invalidate user cache after soft delete
        void redis.del(cacheKeys.userById(data.id));

        console.log(`✅ User deleted: ${data.id}`);
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error: Internal server error", { status: 500 });
  }
}
