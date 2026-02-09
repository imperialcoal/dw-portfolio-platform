/* eslint-disable no-restricted-properties */
import { resolve } from "node:path";
import * as dotenv from "dotenv";

// Resolve absolute path to the root .env.local
// import.meta.dirname = .../packages/api/tests
// ../../../ = root of monorepo
const envPath = resolve(import.meta.dirname, "../../../.env.local");

// Load standard envs using the absolute path
dotenv.config({ path: envPath });

// OVERRIDE connection string to point to Test DB
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/dw_test";
  process.env.DATABASE_URL = url.toString();
}
