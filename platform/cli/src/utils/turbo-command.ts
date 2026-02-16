import type { CLICommand } from "../types/command.js";
import type { TurboOptions } from "../types/turbo.js";
import { turbo } from "./run.js";

export function turboCommand(
  task: string,
  options: TurboOptions = {},
): CLICommand {
  return () => turbo(task, options);
}
