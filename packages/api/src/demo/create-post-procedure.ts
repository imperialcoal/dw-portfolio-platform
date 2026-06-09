// packages/api/src/demo/create-post-procedure.ts
//
// Returns the tRPC procedure to use for post.create based on DEMO_MODE.
//
// DEMO_MODE=true  → recruiterOrAdminProcedure (recruiter + admin can create posts)
// DEMO_MODE=false → adminProcedure (admin only — core default)
//
// Reading process.env.DEMO_MODE directly rather than through @dw/config
// because DEMO_MODE is not part of the shared config schema — it's a
// demo-only concern that should not pollute the core validator package.
//
// post.ts calls this once at module load time:
//   const createProcedure = getCreatePostProcedure();
//
// To remove demo mode: delete packages/api/src/demo/ and replace
// createProcedure in post.ts with adminProcedure directly.

import { authEnv } from "@dw/validators/auth-env";

import { adminProcedure } from "../trpc";
import { recruiterOrAdminProcedure } from "./recruiter-or-admin-procedure";

const env = authEnv();

/**
 * Returns the correct procedure for post.create.
 * Called once at module load — no runtime overhead per request.
 */
export function getCreatePostProcedure() {
  if (env.DEMO_MODE === "true") {
    return recruiterOrAdminProcedure;
  }
  return adminProcedure;
}
