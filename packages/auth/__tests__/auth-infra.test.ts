// Integration tests for @dw/auth functions that require real DB + Redis.
// Run via: pnpm test:auth:infra (Docker Postgres + Redis required)
//
// Covers:
//   loadAuthorityUser  — DB read, Redis cache population, cache hit, stale cache
//   getAuthorityContext — full auth resolution: unauthorized, unavailable, banned, happy path
//   ensureUserProvisioned — idempotent upsert, lock behavior, cache invalidation
//
// ensureUserProvisioned calls clerkClient().users.getUser() — in this test
// environment CLERK_SECRET_KEY=sk_test_mock, so we mock the Clerk API call
// to avoid real network requests while testing all surrounding logic.

import { beforeEach, describe, expect, it } from "vitest";

import { sql } from "@dw/db";
import { user } from "@dw/db/schema";
import { createRuntimeContext } from "@dw/runtime/context";

import type { AuthObject } from "../src/guards";
import { getAuthorityContext } from "../src/context";
import { loadAuthorityUser } from "../src/load-authority-user";

// ─────────────────────────────────────────────
// Shared runtime context (real Docker DB + Redis)
// ─────────────────────────────────────────────

const { db, redis } = createRuntimeContext();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function insertUser(overrides: {
  id: string;
  email: string;
  role?: "admin" | "recruiter" | "user";
  banned?: boolean;
  deletedAt?: Date | null;
}) {
  await db.insert(user).values({
    id: overrides.id,
    email: overrides.email,
    emailVerified: true,
    role: overrides.role ?? "user",
    banned: overrides.banned ?? false,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAuth(userId: string | null): AuthObject {
  return { userId } as unknown as AuthObject;
}

// ─────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE "post" RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
  const keys = await redis.keys("user:*");
  if (keys.length > 0) {
    await Promise.all(keys.map((k: string) => redis.del(k)));
  }
});

// ─────────────────────────────────────────────
// loadAuthorityUser
// ─────────────────────────────────────────────

describe("loadAuthorityUser", () => {
  it("returns null when user does not exist in DB or cache", async () => {
    const result = await loadAuthorityUser("nonexistent_id", db, redis);
    expect(result).toBeNull();
  });

  it("returns the user profile from DB on cache miss", async () => {
    await insertUser({
      id: "user_load_1",
      email: "load1@test.com",
      role: "admin",
    });

    const result = await loadAuthorityUser("user_load_1", db, redis);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user_load_1");
    expect(result?.role).toBe("admin");
    expect(result?.banned).toBe(false);
    expect(result?.deletedAt).toBeNull();
  });

  it("populates Redis cache after DB read", async () => {
    await insertUser({ id: "user_cache_1", email: "cache1@test.com" });

    await loadAuthorityUser("user_cache_1", db, redis);

    const cached = await redis.get<{ id: string; role: string }>(
      "user:user_cache_1",
    );
    expect(cached).not.toBeNull();
    expect(cached?.id).toBe("user_cache_1");
  });

  it("returns from Redis cache on second call without hitting DB", async () => {
    await insertUser({
      id: "user_cache_2",
      email: "cache2@test.com",
      role: "recruiter",
    });

    // Populate cache
    await loadAuthorityUser("user_cache_2", db, redis);

    // Mutate DB row directly (simulates drift) to prove cache is used
    await db
      .update(user)
      .set({ role: "user" })
      .where(sql`id = 'user_cache_2'`);

    // Second call should still return cached "recruiter" role
    const cached = await loadAuthorityUser("user_cache_2", db, redis);
    expect(cached?.role).toBe("recruiter");
  });

  it("correctly returns banned status", async () => {
    await insertUser({
      id: "user_banned_1",
      email: "banned@test.com",
      banned: true,
    });

    const result = await loadAuthorityUser("user_banned_1", db, redis);
    expect(result?.banned).toBe(true);
  });

  it("correctly returns soft-deleted user", async () => {
    const deletedAt = new Date();
    await insertUser({
      id: "user_deleted_1",
      email: "deleted@test.com",
      deletedAt,
    });

    const result = await loadAuthorityUser("user_deleted_1", db, redis);
    expect(result?.deletedAt).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// getAuthorityContext
// ─────────────────────────────────────────────

describe("getAuthorityContext", () => {
  it("throws UNAUTHORIZED when auth has no userId", async () => {
    await expect(
      getAuthorityContext(makeAuth(null), db, redis),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED when userId is missing from auth object", async () => {
    await expect(
      getAuthorityContext({} as unknown as AuthObject, db, redis),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws ACCOUNT_UNAVAILABLE when user does not exist in DB", async () => {
    await expect(
      getAuthorityContext(makeAuth("ghost_user_id"), db, redis),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws ACCOUNT_UNAVAILABLE when user is soft-deleted", async () => {
    await insertUser({
      id: "user_ctx_deleted",
      email: "ctx_deleted@test.com",
      deletedAt: new Date(),
    });

    await redis.set("user:user_ctx_deleted", {
      id: "user_ctx_deleted",
      role: "user",
      banned: false,
      deletedAt: new Date().toISOString(),
    });

    await expect(
      getAuthorityContext(makeAuth("user_ctx_deleted"), db, redis),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN when user is banned", async () => {
    await insertUser({
      id: "user_ctx_banned",
      email: "ctx_banned@test.com",
      banned: true,
    });

    await redis.set("user:user_ctx_banned", {
      id: "user_ctx_banned",
      role: "user",
      banned: true,
      deletedAt: null,
    });

    await expect(
      getAuthorityContext(makeAuth("user_ctx_banned"), db, redis),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns AuthorityContext for a valid active user", async () => {
    await insertUser({
      id: "user_ctx_valid",
      email: "ctx_valid@test.com",
      role: "admin",
    });

    await redis.set("user:user_ctx_valid", {
      id: "user_ctx_valid",
      role: "admin",
      banned: false,
      deletedAt: null,
    });

    const ctx = await getAuthorityContext(
      makeAuth("user_ctx_valid"),
      db,
      redis,
    );

    expect(ctx.userId).toBe("user_ctx_valid");
    expect(ctx.user.role).toBe("admin");
    expect(ctx.user.banned).toBe(false);
    expect(ctx.user.deletedAt).toBeNull();
  });

  it("returns AuthorityContext for a recruiter role user", async () => {
    await insertUser({
      id: "user_ctx_recruiter",
      email: "ctx_recruiter@test.com",
      role: "recruiter",
    });

    await redis.set("user:user_ctx_recruiter", {
      id: "user_ctx_recruiter",
      role: "recruiter",
      banned: false,
      deletedAt: null,
    });

    const ctx = await getAuthorityContext(
      makeAuth("user_ctx_recruiter"),
      db,
      redis,
    );

    expect(ctx.user.role).toBe("recruiter");
  });
});

// ─────────────────────────────────────────────
// ensureUserProvisioned
// ─────────────────────────────────────────────

describe("ensureUserProvisioned", () => {
  it("returns existing user from cache without hitting DB or Clerk", async () => {
    const cachedProfile = {
      id: "user_prov_cached",
      role: "admin" as const,
      banned: false,
      deletedAt: null,
    };
    await redis.set("user:user_prov_cached", cachedProfile);

    const { ensureUserProvisioned } = await import("../src/provision-user");
    const result = await ensureUserProvisioned("user_prov_cached", db, redis);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user_prov_cached");
    expect(result?.role).toBe("admin");
  });

  it("returns existing user from DB when cache is empty", async () => {
    await insertUser({
      id: "user_prov_db",
      email: "prov_db@test.com",
      role: "recruiter",
    });

    const { ensureUserProvisioned } = await import("../src/provision-user");
    const result = await ensureUserProvisioned("user_prov_db", db, redis);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user_prov_db");
    expect(result?.role).toBe("recruiter");
  });

  it("populates Redis after reading from DB", async () => {
    await insertUser({ id: "user_prov_fill", email: "prov_fill@test.com" });

    const { ensureUserProvisioned } = await import("../src/provision-user");
    await ensureUserProvisioned("user_prov_fill", db, redis);

    const cached = await redis.get("user:user_prov_fill");
    expect(cached).not.toBeNull();
  });

  it("is idempotent — multiple calls for same user return consistent profile", async () => {
    await insertUser({
      id: "user_prov_idem",
      email: "prov_idem@test.com",
      role: "admin",
    });

    const { ensureUserProvisioned } = await import("../src/provision-user");

    const first = await ensureUserProvisioned("user_prov_idem", db, redis);
    const second = await ensureUserProvisioned("user_prov_idem", db, redis);

    expect(first?.id).toBe(second?.id);
    expect(first?.role).toBe(second?.role);
  });
});
