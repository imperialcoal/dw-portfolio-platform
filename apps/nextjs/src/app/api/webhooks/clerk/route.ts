import { headers } from "next/headers";
import { Webhook } from "svix";

import { config } from "@dw/config";
import { bootstrapInfra } from "@dw/runtime/bootstrap";
import { createRuntimeContext } from "@dw/runtime/context";

import type { SupportedClerkEvents } from "./handler";
import type { WebhookEvent } from "~/auth/server";
import { clerkClient } from "~/auth/server";
import { isDemoMode } from "~/demo";
import { getRecruiterEmails } from "~/demo/auth/recruiter-emails";
import { handleClerkWebhook } from "./handler";

export async function POST(req: Request) {
  if (config.app.APP_ENV === "local") {
    await bootstrapInfra();
  }

  const { db, redis } = createRuntimeContext();
  const WEBHOOK_SECRET = config.clerk.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Error: Missing svix headers", { status: 400 });
  }

  const payload = await req.text();
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
      ownerEmails:
        config.auth.OWNER_EMAILS?.split(",").map((s) => s.trim()) ?? [],
      // Demo overlay — recruiterEmails is only populated when DEMO_MODE=true.
      // The handler treats this as a generic optional injection and has no
      // knowledge of demo mode or RECRUITER_EMAILS directly.
      // To remove: delete src/demo/ and remove these two lines.
      recruiterEmails: isDemoMode() ? getRecruiterEmails() : [],
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error handling webhook:", err);
    return new Response("Error: Internal server error", { status: 500 });
  }
}
