import { resolve } from "node:path";
import type { Config } from "drizzle-kit";

import { config } from "@dw/config";

export default {
  schema: resolve(import.meta.dirname, "./src/schema.ts"),
  out: resolve(import.meta.dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: { url: config.db.DIRECT_URL },
  casing: "snake_case",
} satisfies Config;
