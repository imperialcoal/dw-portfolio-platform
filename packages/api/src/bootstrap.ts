// packages/api/src/bootstrap.ts
import { getDb } from "@dw/db/client";
import { getRedis } from "@dw/redis";
import { verifyInfra } from "@dw/health";
import { apiEnv } from "../env";

const env = apiEnv();

export async function bootstrapInfra() {
  if (env.APP_ENV === "production") {
    // In production, remain lazy — don't eagerly connect
    return;
  }

  try {
    console.log("🚀 Initializing local infra...");

    // Initialize DB
    const db = getDb();
    console.log("✅ Database client initialized");

    // Initialize Redis
    const redis = getRedis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log("✅ Redis client initialized");

    // Verify connections
    await verifyInfra(
      {
        execute: (sql) => db.execute(sql),
      },
      {
        ping: () => redis.ping(),
      }
    );

    console.log("🎉 Local infra verified successfully");
  } catch (err) {
    console.error("❌ Failed to initialize infra", err);
    // Optional: exit process if dev infra is critical
    // process.exit(1);
  }
}
