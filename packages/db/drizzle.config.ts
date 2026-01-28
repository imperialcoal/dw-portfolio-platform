import type { Config } from "drizzle-kit";

import { dbEnv } from "./env";

const env = dbEnv();

console.log("--- DEBUG START ---");
console.log("DIRECT_URL Type:", typeof env.DIRECT_URL);
console.log("DIRECT_URL Value:", env.DIRECT_URL);
console.log("--- DEBUG END ---");

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: env.DIRECT_URL },
  casing: "snake_case",
} satisfies Config;
