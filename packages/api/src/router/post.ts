import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { config } from "@dw/config";
import { desc, eq } from "@dw/db";
import { CreatePostSchema, Post } from "@dw/db/schema";
import { cacheKeys } from "@dw/redis";

import { getCreatePostProcedure } from "../demo";
import { adminProcedure, publicProcedure } from "../trpc";

// Demo overlay: when DEMO_MODE=true, recruiters can create posts to
// demonstrate the tRPC pipeline on /admin. The procedure decision is
// fully encapsulated in packages/api/src/demo/ — no demo logic here.
// Delete: packages/api/src/demo/ and replace createProcedure with adminProcedure.
const createProcedure = getCreatePostProcedure();

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

  // DEMO_MODE=true  → recruiterOrAdminProcedure via demo module
  // DEMO_MODE=false → adminProcedure (core default, unchanged)
  create: createProcedure
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

  // Delete is always admin-only — recruiters can create posts to demonstrate
  // the pipeline but cannot destroy data.
  delete: adminProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const res = await ctx.db.delete(Post).where(eq(Post.id, input));

    void Promise.all([
      ctx.redis.del(cacheKeys.postsAll),
      ctx.redis.del(cacheKeys.postById(input)),
    ]);

    return res;
  }),
} satisfies TRPCRouterRecord;
