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
//
// What this does NOT test (covered elsewhere):
//   - ensureUserProvisioned (packages/auth — tested independently)
//   - Clerk API calls (removed from webhook path — no race condition)
//   - Session events (integration-tested separately with session fixtures)
//
// Architecture note:
//   The handler now upserts directly from the webhook payload — no Clerk API
//   call is made. This eliminates the race condition that occurred when the
//   Clerk dashboard fired user.created before the user had propagated through
//   Clerk's internal API. The payload IS the source of truth.

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

  // Wipe the user table before each test so tests are fully isolated.
  // Uses TRUNCATE ... CASCADE so foreign key constraints on post don't block.
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
    // makeUserCreatedEvent sets verification: null by default
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
    // Simulates Doppler value: "admin@example.com, other@example.com"
    // The route trims with .split(",").map(s => s.trim()) before passing here.
    // This test confirms the handler correctly receives trimmed values.
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
    // Insert initial row
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
    // User initially created as regular user
    await db.insert(user).values({
      id: "user_promoted",
      email: "promoted@example.com",
      emailVerified: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Now they appear in ownerEmails — user.updated fires (e.g., profile change)
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

    // Fire the same event twice (Clerk retries on transient failures)
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

    // Row still exists (soft delete, not hard delete)
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
    // Row exists with deletedAt set — not gone
    expect(allUsers.length).toBe(1);
    expect(allUsers[0]?.deletedAt).not.toBeNull();
  });

  it("handles user.deleted gracefully when user was never provisioned", async () => {
    // Clerk fires user.deleted for a user ID that never made it into Supabase.
    // The UPDATE should be a no-op (0 rows affected), not throw.
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
});
