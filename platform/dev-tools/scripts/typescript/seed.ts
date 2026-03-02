import { eq } from "@dw/db";
import { Post, roleEnum, user } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";
import { createRuntimeContext } from "@dw/runtime/context";

const { db, redis } = createRuntimeContext();
const [ADMIN, USER] = roleEnum.enumValues;

/**
 * Seed script for local development
 *
 * Creates test users and posts for development/testing
 * Note: In production, users are created via Clerk webhooks
 */
async function seed() {
  console.log("🚀 Starting database seed...\n");

  // -------- USERS --------
  console.log("👥 Seeding users...");

  const existingUsers = await db.query.user.findMany();

  if (existingUsers.length === 0) {
    // Create test users (simulating Clerk webhook data)
    const testUsers = [
      {
        id: "user_test_admin_123",
        email: "admin@test.com",
        emailVerified: true,
        name: "Admin User",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        role: ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "user_test_john_456",
        email: "john@test.com",
        emailVerified: true,
        name: "John Doe",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=john",
        role: USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "user_test_jane_789",
        email: "jane@test.com",
        emailVerified: true,
        name: "Jane Smith",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=jane",
        role: USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.insert(user).values(testUsers);
    console.log(`✅ Created ${testUsers.length} test users`);

    // Cache test users in Redis
    for (const testUser of testUsers) {
      await redis.set(cacheKeys.userById(testUser.id), testUser, { ex: 300 });
    }
    console.log("✅ Cached test users in Redis\n");
  } else {
    console.log(
      `ℹ️  Found ${existingUsers.length} existing users, skipping user seed\n`,
    );
  }

  // -------- POSTS --------
  console.log("📝 Seeding posts...");

  const existingPosts = await db.query.Post.findMany();

  if (existingPosts.length === 0) {
    // Get a user to author the posts
    const author = await db.query.user.findFirst({
      where: eq(user.email, "john@test.com"),
    });

    if (!author) {
      console.error("❌ No author found, cannot seed posts");
      return;
    }

    const testPosts = [
      {
        title: "Welcome to the Platform",
        content:
          "This is your first post! Edit or delete it to get started with your content.",
        authorId: author.id,
      },
      {
        title: "Getting Started Guide",
        content:
          "Here's a quick guide on how to use this platform effectively. Create, edit, and share your posts with ease.",
        authorId: author.id,
      },
      {
        title: "Tips and Tricks",
        content:
          "Did you know you can use markdown in your posts? Try it out and make your content shine!",
        authorId: author.id,
      },
      {
        title: "Community Guidelines",
        content:
          "Please be respectful to other users. We're building a positive community together.",
        authorId: author.id,
      },
      {
        title: "Feature Announcement",
        content:
          "We've just launched some exciting new features! Check them out in your dashboard.",
        authorId: author.id,
      },
    ];

    const insertedPosts = await db.insert(Post).values(testPosts).returning();
    console.log(`✅ Created ${insertedPosts.length} test posts`);

    // Cache posts in Redis
    for (const post of insertedPosts) {
      await redis.set(cacheKeys.postById(post.id), post, { ex: 3600 });
    }
    await redis.set(cacheKeys.postsAll, insertedPosts, { ex: 3600 });
    console.log("✅ Cached test posts in Redis\n");
  } else {
    console.log(
      `ℹ️  Found ${existingPosts.length} existing posts, skipping post seed\n`,
    );
  }

  // -------- REDIS --------
  console.log("🔴 Seeding Redis test keys...");
  await redis.set("seed:timestamp", new Date().toISOString(), { ex: 3600 });
  await redis.set("seed:test", "ok", { ex: 3600 });
  console.log("✅ Redis test keys created\n");

  console.log("🎉 Seeding complete!\n");
  console.log("Test Users:");
  console.log("  - admin@test.com (Admin)");
  console.log("  - john@test.com (User)");
  console.log("  - jane@test.com (User)");
  console.log(
    "\nYou can use these emails to test Clerk authentication in development.",
  );
}

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
