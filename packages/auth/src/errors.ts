import { TRPCError } from "@trpc/server";

export const AUTH_ERRORS = {
  UNAUTHORIZED: () =>
    new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    }),

  FORBIDDEN: () =>
    new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    }),

  BANNED: () =>
    new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is restricted.",
    }),

  ACCOUNT_UNAVAILABLE: () =>
    new TRPCError({
      code: "UNAUTHORIZED",
      message: "Account is unavailable.",
    }),
};

export type AuthErrorFactory = () => TRPCError;
