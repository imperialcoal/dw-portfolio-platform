import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbEnv } from "@dw/validators/db-env";

import * as schema from "./schema";

export type DbInstance = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  _db?: DbInstance;
  _conn?: postgres.Sql;
};

export function getDb(): DbInstance {
  if (globalForDb._db) {
    return globalForDb._db;
  }

  const env = dbEnv();

  const conn =
    globalForDb._conn ??
    postgres(env.DATABASE_URL, {
      max: 5,
      idle_timeout: 30,
    });

  if (env.NODE_ENV !== "production") {
    globalForDb._conn = conn;
  }

  const db: DbInstance = drizzle(conn, {
    schema,
    casing: "snake_case",
  });

  globalForDb._db = db;

  return db;
}

/**
 * Lazy T3-compatible proxy
 */
export const db: DbInstance = new Proxy({} as DbInstance, {
  get(_target, prop: keyof DbInstance) {
    const realDb = getDb();
    return realDb[prop];
  },
});
