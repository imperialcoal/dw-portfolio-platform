import { execSync } from "child_process";
import postgres from "postgres";

import { config } from "@dw/config";

async function setupTestDb() {
  console.log("🛠️  Setting up Test Database...");

  // Use the validated env var
  const DATABASE_URL = config.db.DATABASE_URL;

  // 1. Connect to Admin DB
  const adminClient = postgres(DATABASE_URL, {
    max: 1,
    onnotice: () => undefined,
  });

  const testDbName = "dw_test";

  try {
    // 2. Drop & Recreate
    await adminClient`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = ${testDbName} AND pid <> pg_backend_pid()
    `;
    await adminClient`DROP DATABASE IF EXISTS ${adminClient(testDbName)}`;
    await adminClient`CREATE DATABASE ${adminClient(testDbName)}`;

    console.log(`✅ Database '${testDbName}' created.`);
  } catch (e) {
    console.error("❌ Failed to create test database:", e);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 3. Construct Test URL
  const urlObj = new URL(DATABASE_URL);
  urlObj.pathname = `/${testDbName}`;
  const testDbUrl = urlObj.toString();

  // 4. Push Schema
  console.log("🔄 Pushing schema to test database...");
  try {
    execSync(`pnpm db:push`, {
      stdio: "inherit",
      cwd: "../../../packages/db",
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
    });
    console.log("✅ Schema synced.");
  } catch (e) {
    console.error("❌ Failed to push schema:", e);
    process.exit(1);
  }
}

export default async function () {
  await setupTestDb();
}
