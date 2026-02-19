/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { AuthObject } from "@dw/auth";
import { assertAdmin, getAuthorityContext } from "@dw/auth";
import { config } from "@dw/config";
import { user } from "@dw/db/schema";
import { rateLimit } from "@dw/redis";
import { createRuntimeContext } from "@dw/runtime/context";

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
  const { db, redis } = createRuntimeContext();
  console.log("APP DB URL:", config.db.DATABASE_URL);
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
    // Resolve authority (guarantees auth + provisioning + status checks)
    const authority = await getAuthorityContext(ctx.auth, ctx.db, ctx.redis);
    console.log("Authority Context:", ctx.auth, ctx.db, ctx.redis);

    // Update lastSeen
    if (config.app.NODE_ENV === "test") {
      await ctx.db
        .update(user)
        .set({ lastSeenAt: new Date() })
        .where(eq(user.id, authority.userId));
    } else {
      void ctx.db
        .update(user)
        .set({ lastSeenAt: new Date() })
        .where(eq(user.id, authority.userId));
    }

    // Enrich context with strong authority typing
    return next({
      ctx: {
        // Don't spread ...ctx here - be explicit about what is passed
        db: ctx.db,
        redis: ctx.redis,
        headers: ctx.headers,
        // Fully typed authority context
        ...authority,
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
  assertAdmin(ctx);
  return next({ ctx });
});

/**
 * Internal procedure
 *
 * If you want a query or mutation to be accessible for internal procedures (health, cron, admin, background jobs), use this.
 *
 * @see https://trpc.io/docs/procedures
 */
export const internalProcedure = t.procedure.use(timingMiddleware);
