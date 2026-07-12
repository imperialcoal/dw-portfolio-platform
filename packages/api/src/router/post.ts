import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { config } from "@dw/config";
import { desc, eq } from "@dw/db";
import { CreatePostSchema, Post } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

import { getCreatePostProcedure } from "../demo";
// Add protectedProcedure when all registered users have writing privileges
import { adminProcedure, publicProcedure } from "../trpc";

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

    // In test mode, await the cache write to prevent race conditions
    if (config.app.NODE_ENV === "test") {
      await ctx.redis.set(cacheKey, posts, { ex: 60 * 60 });
    } else {
      void ctx.redis.set(cacheKey, posts, { ex: 60 * 60 });
    }

    return posts;
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const cacheKey = cacheKeys.postById(input.id);
      type PostRow = typeof Post.$inferSelect;
      const cached = await ctx.redis.get<PostRow>(cacheKey);

      if (cached) return cached;

      const post = await ctx.db.query.Post.findFirst({
        where: eq(Post.id, input.id),
      });

      if (post) {
        void ctx.redis.set(cacheKey, post, { ex: 3600 });
      }

      return post;
    }),

  // Demo overlay: getCreatePostProcedure() returns recruiterOrAdminProcedure
  // when DEMO_MODE=true, otherwise adminProcedure. This is the only place
  // the demo overlay needs to be wired in -- see packages/api/src/demo/.
  create: getCreatePostProcedure()
    .input(CreatePostSchema)
    .mutation(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .insert(Post)
        .values({
          ...input,
          authorId: ctx.user.id,
        })
        .returning();

      void ctx.redis.del(cacheKeys.postsAll);

      return post;
    }),

  // ADMIN ONLY, always -- delete is never exposed to recruiters even in
  // demo mode. Destructive actions stay admin-gated regardless of DEMO_MODE.
  delete: adminProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const res = await ctx.db.delete(Post).where(eq(Post.id, input));

    void Promise.all([
      ctx.redis.del(cacheKeys.postsAll),
      ctx.redis.del(cacheKeys.postById(input)),
    ]);

    return res;
  }),
} satisfies TRPCRouterRecord;
