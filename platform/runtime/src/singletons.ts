import { getDb } from "@dw/db/client";
import { getRedis } from "@dw/redis";

/**
 * Runtime orchestrated accessors.
 * Packages own the singleton lifecycle.
 */

export function runtimeDb() {
  return getDb();
}

export function runtimeRedis() {
  return getRedis();
}
