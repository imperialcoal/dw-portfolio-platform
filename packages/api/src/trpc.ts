/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import type { AuthObject } from "@clerk/backend";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import { ROLES } from "@dw/auth";
import { db } from "@dw/db/client";
import { user } from "@dw/db/schema";
import { cacheKeys, getRedis, rateLimit, redis } from "@dw/redis";

import { apiEnv } from "../env";
import { bootstrapInfra } from "./bootstrap";

const env = apiEnv();

// Eagerly bootstrap infra in dev/staging
if (env.NODE_ENV !== "production") {
  try {
    await bootstrapInfra();
  } catch (err) {
    console.error("❌ Failed to bootstrap infra", err);
  }
}

// initialize redis once per process
getRedis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Type guard to check if auth is a user session (not M2M)
 */
function hasUserId(auth: AuthObject): auth is AuthObject & { userId: string } {
  return "userId" in auth && typeof auth.userId === "string";
}

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = (opts: {
  headers: Headers;
  auth: AuthObject;
}) => {
  return {
    db,
    redis,
    headers: opts.headers,
    auth: opts.auth,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an articifial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

const rateLimitMiddleware = (opts: {
  windowSeconds: number;
  maxRequests: number;
  prefix?: string;
}) =>
  t.middleware(async ({ ctx, path, next }) => {
    const ip =
      ctx.headers.get("x-forwarded-for") ??
      ctx.headers.get("x-real-ip") ??
      "local";

    await rateLimit(ctx.redis, `${ip}:${path}`, opts);

    return next();
  });

const publicRateLimit = rateLimitMiddleware({
  windowSeconds: 60,
  maxRequests: 100,
  prefix: "public",
});

const authRateLimit = rateLimitMiddleware({
  windowSeconds: 60,
  maxRequests: 20,
  prefix: "auth",
});

const protectedRateLimit = rateLimitMiddleware({
  windowSeconds: 60,
  maxRequests: 300,
  prefix: "protected",
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure
  .use(timingMiddleware)
  .use(publicRateLimit);

/**
 * Auth procedure
 *
 * This is used for rate limiting for login.
 */
export const authProcedure = t.procedure
  .use(timingMiddleware)
  .use(authRateLimit);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(protectedRateLimit)
  .use(async ({ ctx, next }) => {
    // Check if user is authenticated with a session (not M2M token)
    if (!hasUserId(ctx.auth)) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const userId = ctx.auth.userId;

    // Try to get user from Redis cache first
    const cacheKey = cacheKeys.userById(userId);
    let profile = await ctx.redis.get<typeof user.$inferSelect>(cacheKey);

    // If not in cache, load from DB
    if (!profile) {
      const dbProfile = await ctx.db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      // Convert undefined to null for consistency
      profile = dbProfile ?? null;

      // Future consideration:
      // If a user signs up and immediately gets redirected to the dashboard,
      // there is a tiny chance the webhook hasn't finished writing to Postgres yet.
      // --- JIT (Just-In-Time) FALLBACK START ---
      // If DB missed the webhook, fetch from Clerk directly and insert NOW.
      // Insert basic record so the user isn't blocked
      // Default to "user" role safely
      // --- JIT FALLBACK END ---

      // Cache the user profile if found (5 min TTL)
      if (profile) {
        void ctx.redis.set(cacheKey, profile, { ex: 300 });
      }
    }

    if (!profile || profile.deletedAt) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found or deleted",
      });
    }

    if (profile.banned) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is banned",
      });
    }

    // Update lastSeenAt (fire-and-forget)
    void ctx.db
      .update(user)
      .set({ lastSeenAt: new Date() })
      .where(eq(user.id, userId));

    // Return enriched context
    return next({
      ctx: {
        // Don't spread ...ctx here - be explicit about what is passed
        db: ctx.db,
        redis: ctx.redis,
        headers: ctx.headers,
        userId,
        user: profile,
      },
    });
  });

/**
 * Admin procedure
 *
 * ONLY accessible to users with the 'admin' role in the database.
 * Uses protectedProcedure first to ensure user exists and is not banned.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // I trust the DB/Redis user object here.
  // I cast to string comparison to be safe, or import Role type if preferred.
  if (ctx.user.role !== ROLES.ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not authorized to perform this action.",
    });
  }

  return next({
    ctx: {
      // Pass through the same context, but now I technically know the role is admin
      ...ctx,
    },
  });
});

/**
 * Internal procedure
 *
 * If you want a query or mutation to be accessible for internal procedures (health, cron, admin, background jobs), use this.
 *
 * @see https://trpc.io/docs/procedures
 */
export const internalProcedure = t.procedure.use(timingMiddleware);
