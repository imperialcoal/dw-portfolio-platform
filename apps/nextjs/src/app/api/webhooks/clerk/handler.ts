import type { SessionWebhookEvent, UserWebhookEvent } from "@clerk/backend";

import type { ClerkPublicMetadata, Role } from "@dw/auth";
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
import { and, eq, sql } from "@dw/db";
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

export interface ClerkWebhookDeps {
  db: DbInstance;
  redis: Redis;
  clerk: {
    updateUserMetadata: (
      userId: string,
      data: { publicMetadata?: ClerkPublicMetadata },
    ) => Promise<void>;
  };
  ownerEmails: string[];
  // Optional extension point — demo module injects recruiterEmails via route.ts.
  // The handler has no knowledge of RECRUITER_EMAILS or demo mode directly.
  recruiterEmails?: string[];
}

const FAILED_SESSION_INCIDENT_THRESHOLD = 5;

export async function handleClerkWebhook(
  evt: SupportedClerkEvents,
  deps: ClerkWebhookDeps,
): Promise<void> {
  const { db, redis, ownerEmails, recruiterEmails = [] } = deps;

  // ── user.created / user.updated ─────────────────────────────────────────

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const data = evt.data;
    if (!data.id) throw new Error("Missing user id");

    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );
    if (!primaryEmail) throw new Error("Missing primary email");

    const isOwner = ownerEmails.includes(primaryEmail.email_address);
    const isRecruiter = recruiterEmails.includes(primaryEmail.email_address);

    // Role priority: admin > recruiter > user.
    // recruiterEmails is an optional injection — empty by default.
    // The demo module populates it via route.ts when DEMO_MODE=true.
    const role: Role = isOwner
      ? ROLES.ADMIN
      : isRecruiter
        ? ROLES.RECRUITER
        : ROLES.USER;

    // ── Stale row cleanup (user.created only) ───────────────────────────────
    //
    // When a user deletes their Clerk account and recreates with the same email,
    // Clerk issues a new user_id. Tombstone any existing row with the same email
    // but a different user_id to free the unique constraint without losing history.
    if (evt.type === "user.created") {
      const staleRows = await db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.email, primaryEmail.email_address),
            sql`${user.id} != ${data.id}`,
          ),
        );

      for (const stale of staleRows) {
        await db
          .update(user)
          .set({
            deletedAt: new Date(),
            email: `deleted-${Date.now()}-${stale.id}@deleted.invalid`,
          })
          .where(eq(user.id, stale.id));

        await redis.del(cacheKeys.userById(stale.id));

        console.log(
          JSON.stringify({
            level: "info",
            webhook: "clerk",
            event: "stale_user_tombstoned",
            staleUserId: stale.id,
            newUserId: data.id,
            email: primaryEmail.email_address,
          }),
        );
      }
    }

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
          email: primaryEmail.email_address,
          emailVerified: primaryEmail.verification?.status === "verified",
          name:
            `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null,
          image: data.image_url || null,
          role,
          updatedAt: new Date(data.updated_at),
        },
      });

    await redis.del(cacheKeys.userById(data.id));

    // Sync role to Clerk publicMetadata so the JWT carries the correct role.
    // Promise.resolve() tolerates a non-Promise return (e.g. vi.fn() in tests).
    await Promise.resolve(
      deps.clerk.updateUserMetadata(data.id, {
        publicMetadata: { role },
      }),
    ).catch((err: unknown) => {
      console.warn(
        JSON.stringify({
          level: "warn",
          webhook: "clerk",
          event: evt.type,
          note: "failed to sync role to Clerk metadata",
          userId: data.id,
          error: String(err),
        }),
      );
    });

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

  if (isSessionEvent(evt)) {
    const data = evt.data;
    const userId = data.user_id;
    const sessionId = data.id;

    if (evt.type === "session.created") {
      await clearFailedSessions(userId).catch(() => undefined);

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
      await clearFailedSessions(userId).catch(() => undefined);
    }

    return;
  }
}
