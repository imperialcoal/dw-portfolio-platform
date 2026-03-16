import { getDb } from "@dw/db/client";
import { verifyInfra } from "@dw/health";
import { getRedis } from "@dw/redis";

/**
 * Verifies that local infrastructure (Postgres + Redis) is reachable.
 *
 * Only called from runtimeEntry() which is already guarded by isNodeRuntime().
 * Uses getDb()/getRedis() directly (raw singletons) rather than
 * runtimeDb()/runtimeRedis() — the Node runtime assertion is redundant here
 * since runtimeEntry() already checked, and using the raw accessors allows
 * the bootstrap test to mock infra without hitting the runtime guard.
 */
export async function bootstrapInfra() {
  try {
    console.log("🚀 Initializing local infra...");
    const db = getDb();
    const redis = getRedis();

    await verifyInfra(
      {
        execute: (sql) => db.execute(sql),
      },
      {
        ping: () => redis.ping(),
        set: (key, value, ex) => redis.set(key, value, { ex }),
        get: (key) => redis.get<string>(key),
      },
    );

    console.log("🎉 Local infra verified successfully");
  } catch (err) {
    console.error("❌ Failed to initialize infra", err);

    // Fatal in test mode — infra failures must be caught and fixed
    if (process.env.NODE_ENV === "test") {
      console.error(
        "❌ CRITICAL: Infrastructure verification failed for test environment.",
      );
      process.exit(1);
    }
  }
}
