import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";

export const description = "Stop Docker for local development";
export default turboCommand("dev-tools:infra:down", {
  filter: WORKSPACE.devtools,
});
