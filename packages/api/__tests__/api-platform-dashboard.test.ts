// Integration tests for the platform dashboard API layer.
//
// What this tests:
//   Post router — role-based access for create and delete
//   Demo overlay — DEMO_MODE=true allows recruiter to create posts
//   Demo overlay — DEMO_MODE=false blocks recruiter from creating posts
//   Demo overlay — delete always requires admin regardless of DEMO_MODE
//   Cache — post.all uses Redis cache; invalidated on create and delete
//   Demo procedure — getCreatePostProcedure() returns correct procedure
//
// What this does NOT test (covered elsewhere):
//   Clerk webhook provisioning (apps/nextjs/__tests__/clerk-webhook.test.ts)
//   Auth context resolution (packages/auth/__tests__/auth-infra.test.ts)
//   Runtime environment guards (platform/runtime/__tests__/)
//
// Architecture note:
//   The demo overlay in packages/api/src/demo/ is tested here by toggling
//   DEMO_MODE via vi.stubEnv() and re-importing the module with
//   vi.resetModules(). This is the correct approach because
//   getCreatePostProcedure() reads process.env.DEMO_MODE at module load
//   time. vi.stubEnv() is used instead of direct process.env assignment
//   to satisfy the no-restricted-properties lint rule and to get automatic
//   cleanup via vi.unstubAllEnvs().

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthObject } from "@dw/auth";
import { ROLES } from "@dw/auth";
import { config } from "@dw/config";
import { sql } from "@dw/db";
import { user } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";
import { createRuntimeContext } from "@dw/runtime/context";

// ─────────────────────────────────────────────
// Shared runtime context (real Docker DB + Redis)
// ─────────────────────────────────────────────

const { db, redis } = createRuntimeContext();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function insertUser(opts: {
  id: string;
  email: string;
  role: "admin" | "recruiter" | "user";
}) {
  await db
    .insert(user)
    .values({
      id: opts.id,
      email: opts.email,
      emailVerified: true,
      role: opts.role,
      banned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
}

function makeAuth(userId: string | null): AuthObject {
  return {
    userId,
    sessionId: "mock-session",
    actor: undefined,
    getToken: () => Promise.resolve("mock-token"),
    debug: () => ({}),
  } as unknown as AuthObject;
}

async function createCaller(
  opts: {
    userId?: string;
    role?: "admin" | "recruiter" | "user";
  } = {},
) {
  if (opts.userId && opts.role) {
    await insertUser({
      id: opts.userId,
      email: `${opts.userId}@test.com`,
      role: opts.role,
    });
  }

  // Dynamic import (not static) — getCreatePostProcedure() resolves
  // DEMO_MODE once at module load. Re-importing here after vi.resetModules()
  // is what lets each describe block's vi.stubEnv("DEMO_MODE", ...) actually
  // take effect on post.create's procedure selection.
  const { appRouter } = await import("../src/root");

  return appRouter.createCaller({
    ...createRuntimeContext(),
    headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    auth: makeAuth(opts.userId ?? null),
  });
}

// Asserts a tRPC mutation/query rejects with the given error code,
// without relying on non-null assertions on the post id.
async function expectForbidden(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
}

async function expectUnauthorized(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ code: "UNAUTHORIZED" });
}

function requirePost<T extends { id: string }>(post: T | undefined): T {
  if (!post) throw new Error("Expected post to be defined in test setup");
  return post;
}

// ─────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────

describe("Platform Dashboard — Post Router", () => {
  beforeEach(async () => {
    await redis.del(cacheKeys.postsAll);
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE "post" RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // ── Sanity ──────────────────────────────────────────────────────────────

  it("should be connected to the test database, not production", () => {
    expect(config.db.DATABASE_URL).toContain("test");
  });

  // ── post.all — public read ──────────────────────────────────────────────

  it("post.all returns empty array when no posts exist", async () => {
    const caller = await createCaller({});
    const posts = await caller.post.all();
    expect(posts).toEqual([]);
  });

  it("post.all is accessible without authentication", async () => {
    const caller = await createCaller({});
    await expect(caller.post.all()).resolves.toBeInstanceOf(Array);
  });

  it("post.all serves from Redis cache on second request", async () => {
    const adminId = "admin_cache_1";
    const caller = await createCaller({ userId: adminId, role: ROLES.ADMIN });

    const first = await caller.post.all();
    const cached = await redis.get(cacheKeys.postsAll);
    expect(cached).not.toBeNull();

    const second = await caller.post.all();
    expect(second).toEqual(first);
  });

  // ── post.create — DEMO_MODE=false (production mode) ────────────────────

  describe("DEMO_MODE=false (production)", () => {
    beforeEach(() => {
      vi.stubEnv("DEMO_MODE", "false");
      vi.resetModules();
    });

    it("admin can create posts", async () => {
      const caller = await createCaller({
        userId: "admin_create_1",
        role: ROLES.ADMIN,
      });

      const post = await caller.post.create({
        title: "Platform Test",
        content: "Testing the platform dashboard pipeline",
      });

      expect(post).toBeDefined();
      expect(post?.title).toBe("Platform Test");
      expect(post?.authorId).toBe("admin_create_1");
    });

    it("recruiter cannot create posts when DEMO_MODE=false", async () => {
      const caller = await createCaller({
        userId: "recruiter_blocked_1",
        role: ROLES.RECRUITER,
      });

      await expectForbidden(
        caller.post.create({ title: "Blocked", content: "Should fail" }),
      );
    });

    it("user cannot create posts", async () => {
      const caller = await createCaller({
        userId: "user_blocked_1",
        role: ROLES.USER,
      });

      await expectForbidden(
        caller.post.create({ title: "Blocked", content: "Should fail" }),
      );
    });

    it("unauthenticated request cannot create posts", async () => {
      const caller = await createCaller({});

      await expectUnauthorized(
        caller.post.create({ title: "Blocked", content: "Should fail" }),
      );
    });
  });

  // ── post.create — DEMO_MODE=true (demo mode) ────────────────────────────

  describe("DEMO_MODE=true (demo mode)", () => {
    beforeEach(() => {
      vi.stubEnv("DEMO_MODE", "true");
      vi.resetModules();
    });

    it("admin can still create posts in demo mode", async () => {
      const caller = await createCaller({
        userId: "admin_demo_1",
        role: ROLES.ADMIN,
      });

      const post = await caller.post.create({
        title: "Admin Demo Post",
        content: "Admin always has access",
      });

      expect(post).toBeDefined();
      expect(post?.title).toBe("Admin Demo Post");
    });

    it("recruiter can create posts when DEMO_MODE=true", async () => {
      const caller = await createCaller({
        userId: "recruiter_demo_1",
        role: ROLES.RECRUITER,
      });

      const post = await caller.post.create({
        title: "Recruiter Demo Post",
        content: "Demonstrating the tRPC pipeline",
      });

      expect(post).toBeDefined();
      expect(post?.title).toBe("Recruiter Demo Post");
      expect(post?.authorId).toBe("recruiter_demo_1");
    });

    it("user still cannot create posts even in demo mode", async () => {
      const caller = await createCaller({
        userId: "user_demo_blocked_1",
        role: ROLES.USER,
      });

      await expectForbidden(
        caller.post.create({ title: "Blocked", content: "Still fails" }),
      );
    });

    it("recruiter post appears in post.all after creation", async () => {
      const caller = await createCaller({
        userId: "recruiter_demo_2",
        role: ROLES.RECRUITER,
      });

      await caller.post.create({
        title: "Visible Post",
        content: "Should appear in post board",
      });

      await redis.del(cacheKeys.postsAll);
      const posts = await caller.post.all();

      expect(posts.some((p) => p.title === "Visible Post")).toBe(true);
    });
  });

  // ── post.delete — always admin-only ─────────────────────────────────────

  describe("post.delete — admin only regardless of DEMO_MODE", () => {
    it("admin can delete a post (DEMO_MODE=false)", async () => {
      const adminCaller = await createCaller({
        userId: "admin_delete_1",
        role: ROLES.ADMIN,
      });

      const post = requirePost(
        await adminCaller.post.create({
          title: "To Be Deleted",
          content: "Will be removed",
        }),
      );

      await redis.del(cacheKeys.postsAll);
      await expect(adminCaller.post.delete(post.id)).resolves.toBeDefined();

      await redis.del(cacheKeys.postsAll);
      const posts = await adminCaller.post.all();
      expect(posts.find((p) => p.id === post.id)).toBeUndefined();
    });

    it("recruiter cannot delete posts even when DEMO_MODE=true", async () => {
      vi.stubEnv("DEMO_MODE", "true");
      vi.resetModules();

      const adminCaller = await createCaller({
        userId: "admin_delete_2",
        role: ROLES.ADMIN,
      });
      const post = requirePost(
        await adminCaller.post.create({
          title: "Admin Created",
          content: "Only admin can delete this",
        }),
      );

      const recruiterCaller = await createCaller({
        userId: "recruiter_delete_1",
        role: ROLES.RECRUITER,
      });

      await expectForbidden(recruiterCaller.post.delete(post.id));
    });

    it("unauthenticated request cannot delete posts", async () => {
      const adminCaller = await createCaller({
        userId: "admin_delete_3",
        role: ROLES.ADMIN,
      });
      const post = requirePost(
        await adminCaller.post.create({
          title: "Protected Post",
          content: "Cannot be deleted without auth",
        }),
      );

      const anonCaller = await createCaller({});
      await expectUnauthorized(anonCaller.post.delete(post.id));
    });
  });

  // ── Cache invalidation ──────────────────────────────────────────────────
  //
  // post.create and post.delete invalidate the cache via `void ctx.redis.del(...)`
  // — intentionally fire-and-forget so mutation latency isn't held hostage to
  // cache eviction. That means the deletion may not have completed the instant
  // the mutation's own Promise resolves. waitForCacheClear polls briefly
  // instead of asserting immediately, matching the real fire-and-forget
  // contract instead of forcing synchronous behavior that doesn't exist.

  async function waitForCacheClear(
    key: string,
    timeoutMs = 2000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = await redis.get(key);
      if (value === null) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Cache key "${key}" was not cleared within ${timeoutMs}ms`);
  }

  describe("cache invalidation", () => {
    it("creating a post invalidates the postsAll cache", async () => {
      const caller = await createCaller({
        userId: "admin_cache_inv_1",
        role: ROLES.ADMIN,
      });

      await caller.post.all();
      const beforeCreate = await redis.get(cacheKeys.postsAll);
      expect(beforeCreate).not.toBeNull();

      await caller.post.create({
        title: "Cache Bust",
        content: "Invalidates the list cache",
      });

      await waitForCacheClear(cacheKeys.postsAll);
    });

    it("deleting a post invalidates the postsAll cache", async () => {
      const caller = await createCaller({
        userId: "admin_cache_inv_2",
        role: ROLES.ADMIN,
      });

      const post = requirePost(
        await caller.post.create({
          title: "Delete Cache Test",
          content: "Will be deleted",
        }),
      );

      await caller.post.all();
      const beforeDelete = await redis.get(cacheKeys.postsAll);
      expect(beforeDelete).not.toBeNull();

      await caller.post.delete(post.id);

      await waitForCacheClear(cacheKeys.postsAll);
    });
  });
});

// ─────────────────────────────────────────────
// Demo overlay — getCreatePostProcedure()
// ─────────────────────────────────────────────

describe("Demo Overlay — getCreatePostProcedure()", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns adminProcedure when DEMO_MODE is not set", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { getCreatePostProcedure } =
      await import("../src/demo/create-post-procedure");
    const { adminProcedure } = await import("../src/trpc");
    expect(getCreatePostProcedure()).toBe(adminProcedure);
  });

  it("returns adminProcedure when DEMO_MODE=false", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.resetModules();
    const { getCreatePostProcedure } =
      await import("../src/demo/create-post-procedure");
    const { adminProcedure } = await import("../src/trpc");
    expect(getCreatePostProcedure()).toBe(adminProcedure);
  });

  it("returns recruiterOrAdminProcedure when DEMO_MODE=true", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.resetModules();
    const { getCreatePostProcedure } =
      await import("../src/demo/create-post-procedure");
    const { recruiterOrAdminProcedure } =
      await import("../src/demo/recruiter-or-admin-procedure");
    expect(getCreatePostProcedure()).toBe(recruiterOrAdminProcedure);
  });
});
