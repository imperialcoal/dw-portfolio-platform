import { verifyInfra } from "@dw/health";

import { runtimeDb, runtimeRedis } from "./singletons";

export async function bootstrapInfra() {
  if (process.env.APP_ENV === "production") return;

  try {
    console.log("🚀 Initializing local infra...");

    const db = runtimeDb();
    const redis = runtimeRedis();

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

    // Make infrastructure failures to be fatal in test mode
    if (process.env.NODE_ENV === "test") {
      console.error(
        "❌ CRITICAL: Infrastructure verification failed for test environment.",
      );
      process.exit(1);
    }
  }
}
