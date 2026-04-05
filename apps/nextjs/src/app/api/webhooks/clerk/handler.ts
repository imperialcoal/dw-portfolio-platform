import type { SessionWebhookEvent, UserWebhookEvent } from "@clerk/backend";

import type { AuthorityUser, ClerkPublicMetadata, Role } from "@dw/auth";
import type { DbInstance } from "@dw/db";
import type { Redis } from "@dw/redis";
import {
  clearFailedSessions,
  incrementFailedSessions,
  logIncident,
  logUserActivity,
  markIncidentOpen,
} from "@dw/ai/memory";
import { ROLES } from "@dw/auth";
import { eq } from "@dw/db";
import { user } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

// ─────────────────────────────────────────────
// Supported event union
//
// user.created / user.updated  → UserJSON
// user.deleted                 → UserDeletedJSON (id may be undefined per Clerk spec)
// session.*                    → SessionWebhookEventJSON (extends SessionJSON + user)
//
// "user.passwordChanged" is NOT a Clerk webhook event type and is intentionally omitted.
// ─────────────────────────────────────────────

export type SupportedClerkEvents = UserWebhookEvent | SessionWebhookEvent;

// Session event types that map to SessionWebhookEventJSON — used for narrowing
const SESSION_EVENT_TYPES = new Set([
  "session.created",
  "session.ended",
  "session.removed",
  "session.revoked",
] as const);

type SessionEventType =
  typeof SESSION_EVENT_TYPES extends Set<infer T> ? T : never;

function isSessionEvent(
  evt: SupportedClerkEvents,
): evt is Extract<SessionWebhookEvent, { type: SessionEventType }> {
  return SESSION_EVENT_TYPES.has(evt.type as SessionEventType);
}

interface ClerkWebhookDeps {
  db: DbInstance;
  redis: Redis;
  clerk: {
    updateUserMetadata: (
      userId: string,
      data: { publicMetadata?: ClerkPublicMetadata },
    ) => Promise<void>;
  };
  ensureUserProvisioned: (
    userId: string,
    db: DbInstance,
    redis: Redis,
  ) => Promise<AuthorityUser | null>;
  ownerEmails: string[];
}

const FAILED_SESSION_INCIDENT_THRESHOLD = 5;

export async function handleClerkWebhook(
  evt: SupportedClerkEvents,
  deps: ClerkWebhookDeps,
): Promise<void> {
  const { db, redis, clerk, ensureUserProvisioned, ownerEmails } = deps;

  // ── user.created / user.updated ─────────────────────────────────────────

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const data = evt.data;

    if (!data.id) throw new Error("Missing user id");

    const provisioned = await ensureUserProvisioned(data.id, db, redis);
    if (!provisioned) throw new Error("Failed to provision user");

    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );
    if (!primaryEmail) throw new Error("Missing primary email");

    const isOwner = ownerEmails.includes(primaryEmail.email_address);
    const role: Role = isOwner ? ROLES.ADMIN : ROLES.USER;

    console.log(
      JSON.stringify({
        level: "info",
        webhook: "clerk",
        event: evt.type,
        userId: data.id,
        email: primaryEmail.email_address,
        isOwner,
        role,
        ownerEmailCount: ownerEmails.length,
      }),
    );

    await db
      .insert(user)
      .values({
        id: data.id,
        email: primaryEmail.email_address,
        emailVerified: primaryEmail.verification?.status === "verified",
        name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
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

    // Sync role to Clerk public metadata if it drifted
    const dbUser = await db.query.user.findFirst({
      where: eq(user.id, data.id),
      columns: { role: true },
    });

    const clerkRole = (data.public_metadata as ClerkPublicMetadata).role;

    if (dbUser && clerkRole !== dbUser.role) {
      const lockKey = `lock:user-role-sync:${data.id}`;
      const acquired = await redis.set(lockKey, "1", { nx: true, ex: 15 });
      if (acquired) {
        try {
          await clerk.updateUserMetadata(data.id, {
            publicMetadata: { role: dbUser.role },
          });
          console.log(
            JSON.stringify({
              level: "info",
              webhook: "clerk",
              event: "role_synced_to_clerk",
              userId: data.id,
              role: dbUser.role,
            }),
          );
        } finally {
          await redis.del(lockKey);
        }
      }
    }

    await redis.del(cacheKeys.userById(data.id));

    // Track activity — fire-and-forget, non-critical
    await logUserActivity({
      id: `clerk-${data.id}-${evt.type}-${Date.now()}`,
      eventType: evt.type,
      userId: data.id,
      userEmail: primaryEmail.email_address,
      userName:
        `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
      timestamp: new Date().toISOString(),
      metadata: { isOwner },
    }).catch(() => undefined);

    if (evt.type === "user.created") {
      await clearFailedSessions(data.id).catch(() => undefined);
    }

    return;
  }

  // ── user.deleted ─────────────────────────────────────────────────────────

  if (evt.type === "user.deleted") {
    const data = evt.data;
    // UserDeletedJSON.id is optional — user may have been deleted before full provisioning
    if (!data.id) {
      console.warn(
        JSON.stringify({
          level: "warn",
          webhook: "clerk",
          event: "user.deleted",
          note: "no user id in payload — skipping",
        }),
      );
      return;
    }

    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, data.id));

    await redis.del(cacheKeys.userById(data.id));

    console.log(
      JSON.stringify({
        level: "info",
        webhook: "clerk",
        event: "user.deleted",
        userId: data.id,
      }),
    );

    await logUserActivity({
      id: `clerk-${data.id}-deleted-${Date.now()}`,
      eventType: "user.deleted",
      userId: data.id,
      userEmail: null,
      userName: null,
      timestamp: new Date().toISOString(),
      metadata: {},
    }).catch(() => undefined);

    return;
  }

  // ── session.created / session.ended / session.removed / session.revoked ──
  //
  // All four share SessionWebhookEventJSON:
  //   id: string          (from ClerkResourceJSON)
  //   user_id: string     (from SessionJSON)
  //   status: string      (from SessionJSON)
  //   user: UserJSON|null (added by SessionWebhookEventJSON)
  //
  // Using a Set-based type guard instead of chained if/else avoids the
  // "comparison is always true" lint error on the final narrowed branch.

  if (isSessionEvent(evt)) {
    const data = evt.data; // SessionWebhookEventJSON — fully typed, no `any`
    const userId = data.user_id;
    const sessionId = data.id;

    if (evt.type === "session.created") {
      // Successful sign-in — clear any accumulated failure count
      await clearFailedSessions(userId).catch(() => undefined);

      // Resolve user email from the embedded UserJSON if available
      const userEmail =
        data.user !== null
          ? (data.user.email_addresses.find(
              (e) => e.id === data.user?.primary_email_address_id,
            )?.email_address ?? null)
          : null;

      const userName =
        data.user !== null
          ? `${data.user.first_name ?? ""} ${data.user.last_name ?? ""}`.trim() ||
            null
          : null;

      await logUserActivity({
        id: `clerk-session-${sessionId}-created`,
        eventType: "session.created",
        userId,
        userEmail,
        userName,
        timestamp: new Date().toISOString(),
        metadata: {},
      }).catch(() => undefined);

      return;
    }

    // session.ended / session.removed / session.revoked
    // "abandoned" status = session expired without an explicit sign-out
    const isAbandoned = data.status === "abandoned";

    await logUserActivity({
      id: `clerk-session-${sessionId}-${evt.type.replace("session.", "")}`,
      eventType: "session.ended",
      userId,
      userEmail: null,
      userName: null,
      timestamp: new Date().toISOString(),
      metadata: {},
    }).catch(() => undefined);

    if (isAbandoned) {
      const count = await incrementFailedSessions(userId).catch(() => 0);

      if (count >= FAILED_SESSION_INCIDENT_THRESHOLD) {
        // Hourly dedup bucket — one incident per user per hour at most
        const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60));
        const incidentId = `clerk-auth-${userId}-${hourBucket}`;

        await logIncident({
          type: "clerk_event",
          id: incidentId,
          service: "clerk",
          timestamp: new Date().toISOString(),
          summary: `${count} abandoned sessions for user ${userId} in the last hour`,
          rootCause: `High abandoned session count may indicate a brute-force attempt or auth loop for user ${userId}.`,
          severity: count >= 10 ? "high" : "medium",
          labels: ["auth", "security", "abandoned-sessions", userId],
          commitSha: undefined,
          branch: undefined,
        }).catch(() => undefined);

        await markIncidentOpen(incidentId).catch(() => undefined);

        console.warn(
          JSON.stringify({
            level: "warn",
            webhook: "clerk",
            event: "auth_security_signal",
            userId,
            abandonedCount: count,
            incidentId,
          }),
        );
      }
    } else {
      // Clean end (revoked, removed, or normal sign-out) — reset failure counter
      await clearFailedSessions(userId).catch(() => undefined);
    }

    return;
  }
}
