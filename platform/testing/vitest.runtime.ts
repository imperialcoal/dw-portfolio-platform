import "./vitest.env";

import { execSync } from "node:child_process";

import { bootstrapInfra } from "@dw/runtime/bootstrap";

export default async function () {
  // 1. Ensure DB recreated + seeded
  execSync("pnpm dev-tools:test:setup", { stdio: "inherit" });
  execSync("pnpm dev-tools:db:seed", { stdio: "inherit" });

  // 2. Boot runtime singletons (redis/db pools etc)
  await bootstrapInfra();
}
