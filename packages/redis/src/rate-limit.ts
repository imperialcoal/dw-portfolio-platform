import type { Redis } from "@upstash/redis";
import { TRPCError } from "@trpc/server";

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  prefix?: string;
}

export async function rateLimit(
  redis: Redis,
  key: string,
  opts: RateLimitOptions,
) {
  const now = Date.now();
  const bucket = Math.floor(now / 1000 / opts.windowSeconds);

  const windowKey = `${opts.prefix ?? "ratelimit"}:${key}:${bucket}`;

  const pipeline = redis.pipeline();
  pipeline.incr(windowKey);
  pipeline.expire(windowKey, opts.windowSeconds);

  const result = await pipeline.exec();

  const count = Number(result[0]);

  if (count > opts.maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Slow down.",
    });
  }
}
