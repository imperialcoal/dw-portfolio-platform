import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { sendContactEmail } from "@dw/messaging";

import { publicProcedure } from "../trpc";

export const contactRouter = {
  send: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.email(),
        message: z.string().min(10).max(2000),
      }),
    )
    .mutation(async ({ input }) => {
      await sendContactEmail(input);
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
