import { authRouter } from "./router/auth";
import { contactRouter } from "./router/contact";
import { postRouter } from "./router/post";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  post: postRouter,
  contact: contactRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
