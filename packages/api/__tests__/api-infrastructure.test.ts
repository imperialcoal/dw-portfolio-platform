import type { AuthObject } from "@clerk/backend";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ROLES } from "@dw/auth";
import { config } from "@dw/config";
import { user } from "@dw/db/schema";
import { cacheKeys, clearRedis } from "@dw/redis";
import { createRuntimeContext } from "@dw/runtime/context";

import { appRouter } from "../src/index";

const { db, redis } = createRuntimeContext();

// Helper to create a caller with a REAL user in the DB
// You can now pass `auth` explicitly or let it be automatically mocked.
const createCaller = async ({
  role,
  userId,
  auth,
}: {
  role?: string;
  userId?: string;
  auth?: AuthObject;
} = {}) => {
  // 1. Seed the User in the DB if a userId is provided
  if (userId) {
    await db
      .insert(user)
      .values({
        id: userId,
        email: `test-${userId}@example.com`,
        role: role ?? "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing(); // Prevent errors if test re-runs
  }

  // 2. Default mock auth if not provided
  const mockAuth: AuthObject = {
    userId: userId ?? null,
    sessionId: "mock-session",
    actor: undefined,
    getToken: () => Promise.resolve("mock-token"),
    debug: () => ({}),
  } as unknown as AuthObject;

  const finalAuth: AuthObject = auth ?? mockAuth;

  // 3. Create the Caller
  return appRouter.createCaller({
    ...createRuntimeContext(),
    headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    auth: finalAuth,
  });
};

describe("API Infrastructure", () => {
  // Clear redis to ensure we aren't hitting stale cache from previous test runs
  beforeEach(async () => {
    await clearRedis();
  });

  // Cleanup
  afterEach(async () => {
    // reset tables used in tests
    await db.execute(sql`TRUNCATE TABLE "post" RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
  });

  // Ensure the connection string includes 'dw_test'
  // This prevents catastrophic data loss if env vars are misconfigured
  it("should be connected to the test database, not production/dev", () => {
    expect(config.db.DATABASE_URL).toContain("dw_test");
  });

  // Simluate middleware failure
  it("should reject if the auth context is missing entirely", async () => {
    const malformedCaller = await createCaller({ auth: undefined });

    await expect(
      malformedCaller.post.create({ title: "...", content: "..." }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  // Requirement 1 & 2: Auth Middleware & Protected Route
  it("should block guests and regular users from creating posts", async () => {
    const scenarios = [
      { role: undefined, userId: undefined, expected: "UNAUTHORIZED" },
      { role: ROLES.USER, userId: "user_123", expected: "FORBIDDEN" },
    ];

    for (const { role, userId, expected } of scenarios) {
      const caller = await createCaller({ role, userId });
      await expect(
        caller.post.create({ title: "Test Post", content: "..." }),
      ).rejects.toMatchObject({ code: expected });
    }
  });

  // Requirement 3: DB Mutation
  it("should allow admins to write to the DB", async () => {
    const adminId = "admin_test_1";
    // Admin (Has ID, Role = ADMIN)
    const adminCaller = await createCaller({
      role: ROLES.ADMIN,
      userId: adminId,
    });

    const input = {
      title: "Infrastructure Test",
      content: "Verifying DB Write",
    };

    // 1. Run Mutation
    const post = await adminCaller.post.create(input);

    // 2. Verify Response
    expect(post).toBeDefined();
    if (!post) throw new Error("Post creation failed to return data");

    expect(post.title).toBe(input.title);

    // 3. Verify Database (Double Check)
    const dbPost = await db.query.Post.findFirst({
      where: (posts, { eq }) => eq(posts.id, post.id),
    });

    expect(dbPost).toBeDefined();
    expect(dbPost?.authorId).toBe(adminId);
  });

  it("should serve cached posts on second request", async () => {
    const caller = await createCaller({ role: ROLES.ADMIN, userId: "admin_1" });

    // First request populates cache
    const firstResult = await caller.post.all();

    // Verify cache was populated
    const cachedPosts = await redis.get(cacheKeys.postsAll);
    expect(cachedPosts).toBeDefined();
    expect(cachedPosts).toEqual(firstResult); // Ensure cache matches response

    // Second request should use cache
    const secondResult = await caller.post.all();
    expect(secondResult).toEqual(firstResult); // Results should be identical
  });
});
