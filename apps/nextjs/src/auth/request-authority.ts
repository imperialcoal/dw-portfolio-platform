import { cache } from "react";

import { getAuthorityContext } from "@dw/auth";
import { createRuntimeContext } from "@dw/runtime/context";

import { auth } from "./server";

/**
 * Next.js App Router adapter.
 * Resolves Clerk auth + runtime context
 * into a centralized AuthorityContext.
 */
export const getRequestAuthority = cache(async () => {
  const authObj = await auth();
  const { db, redis } = createRuntimeContext();

  return getAuthorityContext(authObj, db, redis);
});
