import { getDb } from "@dw/db/client";
import { redis } from "@dw/redis";
import { v4 as uuid } from "uuid";
import { Post } from "@dw/db/schema";

async function seed() {
  const db = getDb();

  console.log("🚀 Seeding Postgres...");

  // Create a test user if none exists
  const userCount = await db.query.user.findMany();
  if (userCount.length === 0) {
    await db.insert(Post).values([
      { id: uuid(), title: "Hello World", content: "First post" },
      { id: uuid(), title: "Another Post", content: "Second post" },
    ]);
    console.log("✅ Seeded posts");
  }

  console.log("🚀 Seeding Redis...");
  await redis.set("seed:test", "ok", { ex: 3600 });
  console.log("✅ Seeded Redis keys");

  console.log("🎉 Seeding complete!");
}

seed().catch(console.error);
