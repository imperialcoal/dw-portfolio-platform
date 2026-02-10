import { execSync } from "child_process";
import { resolve } from "path";
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
    await adminClient`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${testDbName} AND pid <> pg_backend_pid()`;
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

  // 4. Push Schema AND Seed (Unified Step)
  try {
    // A. Push Schema
    // RESOLVE ABSOLUTE PATHS
    // Points to: .../packages/db
    const dbPackagePath = resolve(
      import.meta.dirname,
      "../../../../packages/db",
    );
    // Points to: .../packages/db/drizzle.config.ts
    const configPath = resolve(dbPackagePath, "drizzle.config.ts");

    console.log("🔄 Pushing schema...");
    console.log(`   Config: ${configPath}`);

    // EXECUTE
    // Run inside packages/db so it finds node_modules correctly
    // But pass --config with the FULL ABSOLUTE PATH
    execSync(`pnpm db:push --config=${configPath}`, {
      stdio: "inherit",
      cwd: dbPackagePath,
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
    console.log("✅ Schema synced.");

    // B. Run Seed (Using the SAME testDbUrl)
    console.log("🌱 Seeding test data...");
    // Execute the seed script file directly to avoid circular package.json script lookups
    const seedScriptPath = resolve(import.meta.dirname, "./seed.ts");
    execSync(`pnpm tsx ${seedScriptPath}`, {
      stdio: "inherit",
      // Pass the Test DB URL to the seed script
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
    console.log("✅ Seeding complete.");
  } catch (e) {
    console.error("❌ Provisioning failed:", e);
    process.exit(1);
  }
}

setupTestDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
