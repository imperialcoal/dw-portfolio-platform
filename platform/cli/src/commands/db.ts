import type { Command } from "commander";

import { run } from "../utils/run.js";

export const registerDbCommands = (program: Command) => {
  const db = program.command("db").description("Database operations");

  db.command("push").action(() => run("pnpm -w db:push"));
  db.command("generate").action(() => run("pnpm -w db:generate"));
  db.command("studio").action(() => run("pnpm -w db:studio"));
};
