// packages/api/src/demo/index.ts
//
// Demo module for the API package.
// Self-contained — all demo concerns for @dw/api live here.
//
// Currently provides:
//   getCreatePostProcedure() — returns the correct tRPC procedure for
//   post.create based on DEMO_MODE, allowing recruiters to demonstrate
//   the post pipeline on /admin when demo mode is active.
//
// To remove demo mode: delete this directory and revert post.ts to use
// adminProcedure directly.

export { getCreatePostProcedure } from "./create-post-procedure";
