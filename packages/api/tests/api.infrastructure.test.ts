import type { AuthObject } from "@clerk/backend";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ROLES } from "@dw/auth";
import { config } from "@dw/config";
import { user } from "@dw/db/schema";
import { clearRedis } from "@dw/redis";
import { createRuntimeContext } from "@dw/runtime/context";

import { appRouter } from "../src/index";

const { db } = createRuntimeContext();

// Helper to create a caller with a REAL user in the DB
const createCaller = async (role?: string, userId?: string) => {
  // 1. Seed the User in the DB (Platform Engineering Approach)
  // This allows the actual `trpc.ts` middleware to run, fetch the user,
  // and validate the role, exactly like production.
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

  // 2. Mock the Clerk Auth Object
  // We cast to `any` to avoid mocking 50+ Clerk properties,
  // but we satisfy the `hasUserId` check in trpc.ts
  const mockAuth = {
    userId: userId ?? null,
    sessionId: "mock-session",
    actor: null,
    getToken: () => Promise.resolve("mock-token"),
    debug: () => undefined,
  } as unknown as AuthObject;

  // 3. Create the Caller
  return appRouter.createCaller({
    ...createRuntimeContext(),
    headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    auth: mockAuth,
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
    await db.execute(sql`TRUNCATE TABLE "Post" RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
  });

  // Ensure the connection string includes 'dw_test'
  // This prevents catastrophic data loss if env vars are misconfigured
  it("should be connected to the test database, not production/dev", () => {
    expect(config.db.DATABASE_URL).toContain("dw_test");
  });

  // Simluate middleware failure
  it("should reject if the auth context is missing entirely", async () => {
    const malformedCaller = appRouter.createCaller({
      ...createRuntimeContext(),
      headers: null as unknown as Headers,
      auth: null as unknown as AuthObject,
    });

    await expect(
      malformedCaller.post.create({ title: "...", content: "..." }),
    ).rejects.toThrow();
  });

  // Requirement 1 & 2: Auth Middleware & Protected Route
  it("should block guests and regular users from creating posts", async () => {
    // Guest (No ID)
    const guestCaller = await createCaller(undefined, undefined);

    await expect(
      guestCaller.post.create({
        title: "Hacker Post",
        content: "Should fail",
      }),
    ).rejects.toThrow("UNAUTHORIZED");

    // Regular User (Has ID, Role = USER)
    const userCaller = await createCaller(ROLES.USER, "user_123");

    await expect(
      userCaller.post.create({
        title: "User Post",
        content: "Should fail",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  // Requirement 3: DB Mutation
  it("should allow admins to write to the DB", async () => {
    const adminId = "admin_test_1";
    // Admin (Has ID, Role = ADMIN)
    const adminCaller = await createCaller(ROLES.ADMIN, adminId);

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
});
