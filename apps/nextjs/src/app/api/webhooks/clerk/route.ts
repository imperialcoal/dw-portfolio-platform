import { headers } from "next/headers";
import { Webhook } from "svix";

import { config } from "@dw/config";
import { bootstrapInfra } from "@dw/runtime/bootstrap";
import { createRuntimeContext } from "@dw/runtime/context";

import type { SupportedClerkEvents } from "./handler";
import type { WebhookEvent } from "~/auth/server";
import { clerkClient } from "~/auth/server";
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
      // Read unconditionally, same as ownerEmails above — RECRUITER_EMAILS
      // is role-classification data present in both stg and prd Doppler
      // configs, not gated by DEMO_MODE. getRecruiterEmails() already
      // returns [] safely if the variable is unset in a given environment,
      // so no isDemoMode() check is needed here at all. (Previously this
      // was `isDemoMode() ? getRecruiterEmails() : []` — that gate meant
      // prd always received [] regardless of its own RECRUITER_EMAILS
      // value, which was the actual cause of role computation disagreeing
      // between stg and prd for the same identity. DEMO_MODE still
      // exclusively gates the demo UI/overlay itself — src/demo/ — not
      // this data.)
      recruiterEmails: getRecruiterEmails(),
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error handling webhook:", err);
    return new Response("Error: Internal server error", { status: 500 });
  }
}
