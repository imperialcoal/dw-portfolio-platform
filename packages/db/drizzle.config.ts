import type { Config } from "drizzle-kit";

import { config } from "@dw/config";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: config.db.DIRECT_URL },
  casing: "snake_case",
} satisfies Config;
