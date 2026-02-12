import { getDb } from "@dw/db/client";
import { getRedis } from "@dw/redis";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Runtime orchestrated accessors.
 * Packages own the singleton lifecycle.
 */

export function runtimeDb() {
  return getDb();
}

export function runtimeRedis() {
  return getRedis({
    url: requireEnv("UPSTASH_REDIS_REST_URL"),
    token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  });
}
