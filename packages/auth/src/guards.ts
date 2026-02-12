import type { AuthObject } from "@clerk/backend";

export type { AuthObject };

export function hasUserId(
  auth: AuthObject | null | undefined,
): auth is AuthObject & { userId: string } {
  return auth != null && "userId" in auth && typeof auth.userId === "string";
}
