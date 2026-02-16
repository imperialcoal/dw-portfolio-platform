import { execa } from "execa";

import type { TurboOptions } from "../types/turbo.js";

export async function turbo(task: string, options: TurboOptions = {}) {
  const args = ["turbo", "run", task];

  if (options.filter) {
    args.push(`--filter=${options.filter}`);
  }

  return execa("pnpm", args, {
    stdio: "inherit",
  });
}
