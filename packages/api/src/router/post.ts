import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { config } from "@dw/config";
import { desc, eq } from "@dw/db";
import { CreatePostSchema, Post } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

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

  // Currently Admin is the only user that can create posts
  // create: protectedProcedure
  //   .input(CreatePostSchema)
  //   .mutation(async ({ ctx, input }) => {
  //     const result = await ctx.db.insert(Post).values({
  //       ...input,
  //       authorId: ctx.user.id,
  //     });

  //     void ctx.redis.del(cacheKeys.postsAll);

  //     return result;
  //   }),

  // ADMIN ONLY: Currently only Admin can create posts
  // In the future, I will change this back to `protectedProcedure`
  // and add logic to enforce `authorId` matches `ctx.user.id`.
  create: adminProcedure
    .input(CreatePostSchema)
    .mutation(async ({ ctx, input }) => {
      // ADD .returning()
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

  // Currently Admin is the only user that can delete posts
  // delete: protectedProcedure
  //   .input(z.string())
  //   .mutation(async ({ ctx, input }) => {
  //     const res = await ctx.db.delete(Post).where(eq(Post.id, input));

  //     void Promise.all([
  //       ctx.redis.del(cacheKeys.postsAll),
  //       ctx.redis.del(cacheKeys.postById(input)),
  //     ]);

  //     return res;
  //   }),

  // ADMIN ONLY: Currently only admin can delete
  delete: adminProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const res = await ctx.db.delete(Post).where(eq(Post.id, input));

    void Promise.all([
      ctx.redis.del(cacheKeys.postsAll),
      ctx.redis.del(cacheKeys.postById(input)),
    ]);

    return res;
  }),
} satisfies TRPCRouterRecord;
