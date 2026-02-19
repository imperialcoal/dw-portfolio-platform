import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("creates user on user.created", async () => {
    const mockClerk = {
      updateUserMetadata: vi.fn(),
    };

    const evt = makeUserCreatedEvent("user_1", "test@example.com");

    // ensureUserProvisioned must return a non-null value, otherwise the
    // handler throws "Failed to provision user" before doing any DB work.
    const mockEnsure = vi.fn().mockResolvedValue({
      id: "user_1",
      email: "test@example.com",
      role: "user",
    });

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: mockClerk,
      ensureUserProvisioned: mockEnsure,
      ownerEmails: [],
    });

    const inserted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_1"),
    });

    expect(inserted).toBeDefined();
    expect(inserted?.email).toBe("test@example.com");
    expect(inserted?.role).toBe("user");
  });

  it("syncs role to Clerk when roles differ", async () => {
    const mockClerk = {
      updateUserMetadata: vi.fn(),
    };

    // admin@test.com is in ownerEmails → DB role will be "admin".
    // clerkMetadataRole is undefined → metadata.role is undefined → differs
    // from "admin" → updateUserMetadata should be called.
    const evt = makeUserUpdatedEvent("user_2", "admin@test.com");

    const mockEnsure = vi.fn().mockResolvedValue({
      id: "user_2",
      email: "admin@test.com",
      role: "admin",
    });

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: mockClerk,
      ensureUserProvisioned: mockEnsure,
      ownerEmails: ["admin@test.com"],
    });

    expect(mockClerk.updateUserMetadata).toHaveBeenCalledWith("user_2", {
      publicMetadata: { role: "admin" },
    });
  });

  it("does not sync when roles already match", async () => {
    const mockClerk = {
      updateUserMetadata: vi.fn(),
    };

    // Not in ownerEmails → DB role is "user".
    // clerkMetadataRole is also "user" → roles match → no sync.
    const evt = makeUserUpdatedEvent("user_3", "regular@test.com", "user");

    const mockEnsure = vi.fn().mockResolvedValue({
      id: "user_3",
      email: "regular@test.com",
      role: "user",
    });

    await handleClerkWebhook(evt, {
      db,
      redis,
      clerk: mockClerk,
      ensureUserProvisioned: mockEnsure,
      ownerEmails: [],
    });

    expect(mockClerk.updateUserMetadata).not.toHaveBeenCalled();
  });

  it("soft deletes user on user.deleted", async () => {
    await db.insert(user).values({
      id: "user_del",
      email: "del@test.com",
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
      ensureUserProvisioned: vi.fn(),
      ownerEmails: [],
    });

    const deleted = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, "user_del"),
    });

    expect(deleted?.deletedAt).toBeTruthy();
  });

  it("is idempotent for duplicate updates", async () => {
    const mockClerk = {
      updateUserMetadata: vi.fn(),
    };

    // "user" role in both Clerk metadata and ownerEmails result → no sync
    // just want to confirm the upsert doesn't create duplicates.
    const evt = makeUserUpdatedEvent("user_idem", "idem@test.com", "user");

    const mockEnsure = vi.fn().mockResolvedValue({
      id: "user_idem",
      email: "idem@test.com",
      role: "user",
    });

    const deps = {
      db,
      redis,
      clerk: mockClerk,
      ensureUserProvisioned: mockEnsure,
      ownerEmails: [],
    };

    await handleClerkWebhook(evt, deps);
    await handleClerkWebhook(evt, deps);

    const users = await db.query.user.findMany();
    expect(users.length).toBe(1);
  });
});
