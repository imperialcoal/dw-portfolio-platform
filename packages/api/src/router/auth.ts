import type { TRPCRouterRecord } from "@trpc/server";

// Add authProcedure later for login rate limiting
import {
  internalProcedure,
  protectedProcedure,
  publicProcedure,
} from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  // Redis test
  testRedis: internalProcedure.query(async ({ ctx }) => {
    const timestamp = Date.now().toString();
    await ctx.redis.set("test_connection", timestamp);
    const val = await ctx.redis.get("test_connection");
    return {
      message: "Redis is healthy!",
      storedValue: val,
      match: val === timestamp,
    };
  }),

  // DB test
  testDb: internalProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.execute("SELECT 1");
    return {
      message: "DB is healthy!",
      result,
    };
  }),
  
  getSecretMessage: protectedProcedure.query(() => {
    return "you can see this secret message!";
  }),
} satisfies TRPCRouterRecord;
