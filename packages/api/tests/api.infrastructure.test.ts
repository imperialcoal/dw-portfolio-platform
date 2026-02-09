import type { AuthObject } from "@clerk/backend";
import { describe, expect, it } from "vitest";

import { ROLES } from "@dw/auth";
import { db } from "@dw/db/client";
import { user } from "@dw/db/schema";
import { redis } from "@dw/redis";

import { appRouter } from "../src/index";

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
    db,
    redis, // Pass the real redis proxy (it uses mocks in CI)
    headers: new Headers(),
    auth: mockAuth,
  });
};

describe("API Infrastructure", () => {
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

    // Cleanup
    await adminCaller.post.delete(post.id);
  });
});
