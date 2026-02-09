import { config } from "@dw/config";
import { getDb } from "@dw/db/client";
import { getRedis } from "@dw/redis";

export const db = getDb();

export const redis = getRedis({
  url: config.app.UPSTASH_REDIS_REST_URL,
  token: config.app.UPSTASH_REDIS_REST_TOKEN,
});
