import type { WebhookEvent } from "@clerk/backend";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";

import { authEnv } from "@dw/auth";
import { db } from "@dw/db/client";
import { user } from "@dw/db/schema";
import { cacheKeys, redis } from "@dw/redis";

const env = authEnv();

export async function POST(req: Request) {
  const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;

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

        await db
          .insert(user)
          .values({
            id: data.id,
            email: primaryEmail.email_address,
            emailVerified: primaryEmail.verification?.status === "verified",
            name:
              `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
            image: data.image_url || null,
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

        await db
          .update(user)
          .set({
            email: primaryEmail.email_address,
            emailVerified: primaryEmail.verification?.status === "verified",
            name:
              `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
            image: data.image_url || null,
            updatedAt: new Date(data.updated_at),
          })
          .where(eq(user.id, data.id));

        // Invalidate user cache after update
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
