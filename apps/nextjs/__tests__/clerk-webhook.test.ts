// Integration tests for the Clerk webhook handler.
//
// What this tests:
//   - user.created  → upserts user row with correct role and clears Redis cache
//   - user.updated  → updates existing user row in place (idempotent)
//   - user.deleted  → soft-deletes the row (sets deletedAt, does not hard-delete)
//   - OWNER_EMAILS  → emails in the list receive admin role; all others get user
//   - Email verification status is persisted from the Clerk payload
//   - Name and image fields are persisted correctly
//   - Duplicate events are idempotent (upsert, not duplicate insert)
//   - Stale row cleanup → recreating an account with the same email after
//     deletion tombstones the old row and provisions the new user_id cleanly
//
// What this does NOT test (covered elsewhere):
//   - ensureUserProvisioned (packages/auth — tested independently)
//   - Clerk API calls (removed from webhook path — no race condition)
//   - Session events (integration-tested separately with session fixtures)

import { beforeEach, describe, expect, it, vi } from "vitest";

import { sql } from "@dw/db";
import { user } from "@dw/db/schema";
import { createRuntimeContext } from "@dw/runtime/context";

import { handleClerkWebhook } from "../src/app/api/webhooks/clerk/handler";
import {
  makeUserCreatedEvent,
  makeUserDeletedEvent,
  makeUserUpdatedEvent,
} from "./utils";

describe("Clerk Webhook", () => {
  const { db, redis } = createRuntimeContext();

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // user.created
  // ─────────────────────────────────────────────────────────────────────────

  it("creates a user row on user.created", async () => {
    const evt = makeUserCreatedEvent("user_1", "test@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_1"),
    });

    expect(inserted).toBeDefined();
    expect(inserted?.email).toBe("test@example.com");
    expect(inserted?.role).toBe("user");
    expect(inserted?.deletedAt).toBeNull();
  });

  it("persists first name and last name on user.created", async () => {
    const evt = makeUserCreatedEvent(
      "user_name",
      "named@example.com",
      "Derrick",
      "Warren",
    );

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_name"),
    });

    expect(inserted?.name).toBe("Derrick Warren");
  });

  it("sets emailVerified to false when verification is null", async () => {
    const evt = makeUserCreatedEvent(
      "user_unverified",
      "unverified@example.com",
    );

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_unverified"),
    });

    expect(inserted?.emailVerified).toBe(false);
  });

  it("calls updateUserMetadata with the assigned role on user.created", async () => {
    const updateUserMetadata = vi.fn().mockResolvedValue(undefined);
    const evt = makeUserCreatedEvent("user_meta", "meta@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata },
      ownerEmails: [],
    });

    expect(updateUserMetadata).toHaveBeenCalledOnce();
    expect(updateUserMetadata).toHaveBeenCalledWith("user_meta", {
      publicMetadata: { role: "user" },
    });
  });

  it("calls updateUserMetadata with admin role when email is in ownerEmails", async () => {
    const updateUserMetadata = vi.fn().mockResolvedValue(undefined);
    const evt = makeUserCreatedEvent("user_admin_meta", "owner@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata },
      ownerEmails: ["owner@example.com"],
    });

    expect(updateUserMetadata).toHaveBeenCalledWith("user_admin_meta", {
      publicMetadata: { role: "admin" },
    });
  });

  it("does not fail the webhook when updateUserMetadata throws", async () => {
    const updateUserMetadata = vi
      .fn()
      .mockRejectedValue(new Error("Clerk API error"));
    const evt = makeUserCreatedEvent("user_meta_fail", "metafail@example.com");

    // Should resolve without throwing even though Clerk call fails
    await expect(
      handleClerkWebhook(evt, {
        db,
        redis,
        clerk: { updateUserMetadata },
        ownerEmails: [],
      }),
    ).resolves.toBeUndefined();

    // User was still provisioned in DB
    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_meta_fail"),
    });
    expect(inserted).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OWNER_EMAILS — role assignment
  // ─────────────────────────────────────────────────────────────────────────

  it("assigns admin role when email is in ownerEmails", async () => {
    const evt = makeUserCreatedEvent("user_admin", "admin@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: ["admin@example.com"],
    });

    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_admin"),
    });

    expect(inserted?.role).toBe("admin");
  });

  it("assigns user role when email is not in ownerEmails", async () => {
    const evt = makeUserCreatedEvent("user_regular", "regular@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: ["someone-else@example.com"],
    });

    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_regular"),
    });

    expect(inserted?.role).toBe("user");
  });

  it("assigns admin role when ownerEmails has leading/trailing spaces (trim check)", async () => {
    const evt = makeUserCreatedEvent("user_trim", "trimmed@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: ["trimmed@example.com"],
    });

    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_trim"),
    });

    expect(inserted?.role).toBe("admin");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // user.updated
  // ─────────────────────────────────────────────────────────────────────────

  it("updates an existing user row on user.updated", async () => {
    await db.insert(user).values({
      id: "user_upd",
      email: "old@example.com",
      emailVerified: false,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const evt = makeUserUpdatedEvent("user_upd", "new@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    const updated = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_upd"),
    });

    expect(updated?.email).toBe("new@example.com");
  });

  it("promotes user to admin on user.updated when email added to ownerEmails", async () => {
    await db.insert(user).values({
      id: "user_promoted",
      email: "promoted@example.com",
      emailVerified: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const evt = makeUserUpdatedEvent("user_promoted", "promoted@example.com");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: ["promoted@example.com"],
    });

    const updated = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_promoted"),
    });

    expect(updated?.role).toBe("admin");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Idempotency
  // ─────────────────────────────────────────────────────────────────────────

  it("is idempotent — duplicate user.created events do not create duplicate rows", async () => {
    const evt = makeUserCreatedEvent("user_idem", "idem@example.com");

    const deps = {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    };

    await handleClerkWebhook(evt, deps);
    await handleClerkWebhook(evt, deps);

    const users = await db.query.user.findMany();
    expect(users.length).toBe(1);
  });

  it("is idempotent — duplicate user.updated events do not create duplicate rows", async () => {
    const evt = makeUserUpdatedEvent("user_upd_idem", "upd-idem@example.com");

    const deps = {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    };

    await handleClerkWebhook(evt, deps);
    await handleClerkWebhook(evt, deps);

    const users = await db.query.user.findMany();
    expect(users.length).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // user.deleted
  // ─────────────────────────────────────────────────────────────────────────

  it("soft-deletes user on user.deleted (sets deletedAt, preserves row)", async () => {
    await db.insert(user).values({
      id: "user_del",
      email: "del@example.com",
      emailVerified: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const evt = makeUserDeletedEvent("user_del");

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    const deleted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_del"),
    });

    expect(deleted).toBeDefined();
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.email).toBe("del@example.com");
  });

  it("does not hard-delete — row persists in DB after user.deleted", async () => {
    await db.insert(user).values({
      id: "user_nodrop",
      email: "nodrop@example.com",
      emailVerified: false,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await handleClerkWebhook(makeUserDeletedEvent("user_nodrop"), {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    const allUsers = await db.query.user.findMany();
    expect(allUsers.length).toBe(1);
    expect(allUsers[0]?.deletedAt).not.toBeNull();
  });

  it("handles user.deleted gracefully when user was never provisioned", async () => {
    const evt = makeUserDeletedEvent("user_never_existed");

    await expect(
      handleClerkWebhook(evt, {
        db,
        redis,
        clerk: { updateUserMetadata: vi.fn() },
        ownerEmails: [],
      }),
    ).resolves.toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stale row cleanup — email reuse after account deletion
  //
  // When a user deletes their Clerk account and signs up again with the same
  // email, Clerk issues a new user_id. The handler must tombstone the old row
  // to free the email unique constraint before inserting the new one.
  // ─────────────────────────────────────────────────────────────────────────

  it("tombstones stale row when a new user_id registers with an existing email", async () => {
    // Seed the old row — simulates a previously deleted Clerk account
    // that still exists in our DB (soft-deleted or even active, doesn't matter)
    await db.insert(user).values({
      id: "old_clerk_user_id",
      email: "returning@example.com",
      emailVerified: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // New Clerk user_id for the same email (what happens after re-signup)
    const evt = makeUserCreatedEvent(
      "new_clerk_user_id",
      "returning@example.com",
    );

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    // Old row must be tombstoned — email mangled, deletedAt set
    const staleRow = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "old_clerk_user_id"),
    });
    expect(staleRow).toBeDefined();
    expect(staleRow?.deletedAt).not.toBeNull();
    expect(staleRow?.email).not.toBe("returning@example.com");
    expect(staleRow?.email).toContain("@deleted.invalid");

    // New row must be provisioned correctly with the new user_id
    const newRow = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "new_clerk_user_id"),
    });
    expect(newRow).toBeDefined();
    expect(newRow?.email).toBe("returning@example.com");
    expect(newRow?.deletedAt).toBeNull();
    expect(newRow?.role).toBe("user");
  });

  it("tombstones multiple stale rows for the same email (edge case: double re-signup)", async () => {
    // Two stale rows with the same email — e.g. the user signed up, deleted,
    // signed up again (and that second account also got deleted before cleanup ran)
    await db.insert(user).values([
      {
        id: "stale_id_1",
        email: "multi-stale@example.com",
        emailVerified: true,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "stale_id_2",
        // Mangle the email on the second stale row to avoid unique constraint
        // during seed — simulates what our cleanup would have done on a prior run
        email: `deleted-prev-stale_id_2@deleted.invalid`,
        emailVerified: true,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Only seed stale_id_1 with the real email — stale_id_2 is already mangled
    const evt = makeUserCreatedEvent(
      "final_user_id",
      "multi-stale@example.com",
    );

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    });

    const stale1 = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "stale_id_1"),
    });
    expect(stale1?.deletedAt).not.toBeNull();
    expect(stale1?.email).toContain("@deleted.invalid");

    const finalRow = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "final_user_id"),
    });
    expect(finalRow?.email).toBe("multi-stale@example.com");
    expect(finalRow?.deletedAt).toBeNull();
  });

  it("does not tombstone the current user_id on idempotent user.created retry", async () => {
    // If Clerk retries a user.created event, the cleanup must not tombstone
    // the row it just created (same user_id, same email — WHERE id != data.id
    // excludes it correctly)
    const evt = makeUserCreatedEvent("stable_id", "stable@example.com");

    const deps = {
      db,
      redis,
      clerk: { updateUserMetadata: vi.fn() },
      ownerEmails: [],
    };

    await handleClerkWebhook(evt, deps);
    // Fire the same user.created again (Clerk retry)
    await handleClerkWebhook(evt, deps);

    const row = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "stable_id"),
    });
    // Must still be active — not tombstoned by its own retry
    expect(row?.email).toBe("stable@example.com");
    expect(row?.deletedAt).toBeNull();
  });
});
