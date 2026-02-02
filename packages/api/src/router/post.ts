import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { desc, eq } from "@dw/db";
import { CreatePostSchema, Post } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

import { protectedProcedure, publicProcedure } from "../trpc";

export const postRouter = {
  all: publicProcedure.query(async ({ ctx }) => {
    const cacheKey = cacheKeys.postsAll;

    const cached = await ctx.redis.get<(typeof Post.$inferSelect)[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const posts = await ctx.db.query.Post.findMany({
      orderBy: desc(Post.id),
      limit: 10,
    });

    // fire-and-forget
    void ctx.redis.set(cacheKey, posts, {
      ex: 60 * 60, // 1 hour
    });

    return posts;
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const cacheKey = cacheKeys.postById(input.id);

      type PostRow = typeof Post.$inferSelect;
      const cached = await ctx.redis.get<PostRow[]>(cacheKey);

      if (cached) return cached;

      const post = await ctx.db.query.Post.findFirst({
        where: eq(Post.id, input.id),
      });

      if (post) {
        void ctx.redis.set(cacheKey, post, { ex: 3600 });
      }

      return post;
    }),

  create: protectedProcedure
    .input(CreatePostSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.insert(Post).values(input);

      // invalidate relevant caches
      void Promise.all([ctx.redis.del(cacheKeys.postsAll)]);

      return result;
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db.delete(Post).where(eq(Post.id, input));

      void Promise.all([
        ctx.redis.del(cacheKeys.postsAll),
        ctx.redis.del(cacheKeys.postById(input)),
      ]);

      return res;
    }),
} satisfies TRPCRouterRecord;
