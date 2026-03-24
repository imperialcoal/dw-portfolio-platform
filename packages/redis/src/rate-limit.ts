import type { Redis } from "@upstash/redis";
import { TRPCError } from "@trpc/server";

import { config } from "@dw/config";

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
  try {
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
  } catch (error) {
    // Re-throw TRPCErrors (rate limit exceeded) as-is
    if (error instanceof TRPCError) throw error;

    // Redis connection failure — fail open in local, fail closed in cloud
    if (config.app.APP_ENV === "local") {
      console.warn(
        "Rate limiting unavailable — Redis connection failed:",
        error,
      );
      return;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Rate limiting service unavailable.",
    });
  }
}
