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
import { Post, user } from "@dw/db/schema";
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
  "session.pending",
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
  // Set in both stg and prd Doppler configs so role computation agrees
  // across both — DEMO_MODE itself (the recruiter overlay/UI) stays
  // stg-only; this is just data, same as ownerEmails.
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

    // ── Stale row cleanup (user.created only) ─────────────────────────
    //
    // When a user deletes their Clerk account and recreates with the same
    // email, Clerk issues a new user_id. Tombstone any existing row with
    // the same email but a different user_id to free the unique
    // constraint without losing history.
    //
    // Discovered via a real incident (Clerk Development → Production
    // migration, 2026-07): a webhook registered against a new Clerk
    // instance only receives events going forward — it never sees the
    // original user.created for an identity that already existed before
    // the endpoint was registered. That meant this cleanup never ran
    // automatically for the pre-existing owner account, and the old
    // row's posts stayed attached to it after a manual fix. Reassigning
    // post.authorId here, before the tombstone, closes that gap so it
    // self-heals whenever this path *does* run, rather than only being
    // correct when handled manually.
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
          .update(Post)
          .set({ authorId: data.id })
          .where(eq(Post.authorId, stale.id));

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

    // Sync role to Clerk publicMetadata so the JWT carries the correct
    // role. Promise.resolve() tolerates a non-Promise return (e.g.
    // vi.fn() in tests).
    //
    // On failure, this is surfaced as a real dashboard incident, not
    // just a console.warn — discovered via a real 2026-07-11 case where
    // this call failed silently, leaving Clerk's publicMetadata (and
    // therefore the session JWT and the client-side
    // useUserRole()/useIsAdmin()/useIsUser() hooks in
    // packages/auth/src/hooks.ts) showing a stale role for over an hour
    // while Postgres — the actual source of truth for server-side
    // authorization via getAuthorityContext() — was already correct.
    // Not a security gap (server-side enforcement was unaffected
    // throughout), but a real client-UI correctness bug with no
    // visibility until someone happened to check Clerk's dashboard
    // directly.
    await Promise.resolve(
      deps.clerk.updateUserMetadata(data.id, {
        publicMetadata: { role },
      }),
    ).catch((err: unknown) => {
      const errorMessage = String(err);

      console.warn(
        JSON.stringify({
          level: "warn",
          webhook: "clerk",
          event: evt.type,
          note: "failed to sync role to Clerk metadata",
          userId: data.id,
          error: errorMessage,
        }),
      );

      const incidentId = `clerk-metadata-sync-${data.id}-${Date.now()}`;

      void logIncident({
        type: "clerk_event",
        id: incidentId,
        service: "clerk",
        timestamp: new Date().toISOString(),
        summary: `Failed to sync role "${role}" to Clerk publicMetadata for user ${data.id}`,
        rootCause: `updateUserMetadata call failed: ${errorMessage}. Postgres role is correct and server-side authorization is unaffected; Clerk's publicMetadata — and therefore the session JWT and client-side role hooks — will show the previous role until the next successful sync.`,
        severity: "medium",
        labels: ["auth", "clerk", "metadata-sync"],
        commitSha: undefined,
        branch: undefined,
      }).catch(() => undefined);

      void markIncidentOpen(incidentId).catch(() => undefined);
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

    // session.pending is new in Clerk's event catalog and its exact
    // semantics aren't confirmed here — likely a session awaiting an
    // additional step (e.g. MFA) rather than a terminal state, i.e. the
    // opposite lifecycle stage from "ended". Logged distinctly rather than
    // folded into the eventType: "session.ended" fallthrough below, and
    // deliberately excluded from the abandoned-session incident counter
    // until the real semantics are verified against Clerk's docs.
    //
    // `evt.type as string`: the installed @clerk/backend SDK's types don't
    // model "session.pending" yet (confirmed via TS2367 — Extract<> in
    // isSessionEvent()'s return type silently drops it from the narrowed
    // union since it isn't a real member of SessionWebhookEvent), even
    // though SESSION_EVENT_TYPES.has() correctly matches it at runtime.
    // This cast is intentional forward-compatibility, not a type error
    // being suppressed — revisit once the SDK's types catch up.
    if ((evt.type as string) === "session.pending") {
      console.log(
        JSON.stringify({
          level: "info",
          webhook: "clerk",
          event: "session.pending",
          note: "semantics unconfirmed — see handler.ts comment",
          userId,
          sessionId,
        }),
      );

      await logUserActivity({
        id: `clerk-session-${sessionId}-pending`,
        // eventType reuses "session.created" here because
        // UserActivityEventType has no "pending" member yet — not a claim
        // that this IS a creation event. The console.log above is what
        // actually flags it as pending; metadata has no free-form field
        // for this (UserActivityRecord.metadata only accepts ipAddress,
        // userAgent, oauthProvider, previousRole, newRole, isOwner).
        eventType: "session.created",
        userId,
        userEmail: null,
        userName: null,
        timestamp: new Date().toISOString(),
        metadata: {},
      }).catch(() => undefined);

      return;
    }

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
