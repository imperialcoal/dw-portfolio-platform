// platform/runtime/src/bootstrap.ts
import { config } from "@dw/config";
import { verifyInfra } from "@dw/health";

import { db, redis } from "./singletons";

export async function bootstrapInfra() {
  if (config.app.APP_ENV === "production") return;

  try {
    console.log("🚀 Initializing local infra...");

    await verifyInfra(
      { execute: (sql) => db.execute(sql) },
      { ping: () => redis.ping() },
    );

    console.log("🎉 Local infra verified successfully");
  } catch (err) {
    console.error("❌ Failed to initialize infra", err);
  }
}
