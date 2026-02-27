import { turbo } from "./run.js";

export function turboCommand(task, options = {}) {
  return () => turbo(task, options);
}
