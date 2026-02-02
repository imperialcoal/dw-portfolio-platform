import type { Config } from "drizzle-kit";

import { dbEnv } from "./env";

const env = dbEnv();

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: env.DIRECT_URL },
  casing: "snake_case",
} satisfies Config;
