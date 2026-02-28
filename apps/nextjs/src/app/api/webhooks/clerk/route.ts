import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { Webhook } from "svix";

import { ensureUserProvisioned } from "@dw/auth";
import { config } from "@dw/config";
import { bootstrapInfra } from "@dw/runtime/bootstrap";
import { createRuntimeContext } from "@dw/runtime/context";

import type { SupportedClerkEvents, WebhookEvent } from "./handler";
import { handleClerkWebhook } from "./handler";

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
    }) as SupportedClerkEvents;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error: Verification failed", { status: 400 });
  }

  try {
    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: {
        updateUserMetadata: async (userId, data) => {
          const client = await clerkClient();
          await client.users.updateUserMetadata(userId, data);
        },
      },
      ensureUserProvisioned,
      ownerEmails: config.auth.OWNER_EMAILS?.split(",") ?? [],
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error: Internal server error", { status: 500 });
  }
}
