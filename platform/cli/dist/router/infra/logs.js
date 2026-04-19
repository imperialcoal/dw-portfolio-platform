import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";

export const description = "Generate Docker logs for local development";
export default turboCommand("dev-tools:infra:logs", {
  filter: WORKSPACE.devtools,
});
