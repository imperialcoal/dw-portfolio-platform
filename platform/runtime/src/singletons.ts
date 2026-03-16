import { getDb } from "@dw/db/client";
import { getRedis } from "@dw/redis";

import { assertNodeRuntime } from "./capabilities";

/**
 * Returns the database instance.
 * Asserts Node.js runtime — Postgres drivers require TCP sockets
 * which are not available in Edge runtime.
 */
export function runtimeDb() {
  assertNodeRuntime("runtimeDb()");
  return getDb();
}

/**
 * Returns the Redis instance.
 * Asserts Node.js runtime — Upstash Redis REST client uses fetch
 * and technically works in Edge, but we keep it Node-only for
 * consistency and to prevent accidental Edge usage of the singleton.
 *
 * If you need Redis in Edge in the future, use the Upstash REST API
 * directly via fetch rather than through this singleton.
 */
export function runtimeRedis() {
  assertNodeRuntime("runtimeRedis()");
  return getRedis();
}
