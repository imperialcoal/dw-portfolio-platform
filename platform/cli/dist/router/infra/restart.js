import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";
export const description = "Restart Docker for local development";
export default turboCommand("dev-tools:infra:restart", {
    filter: WORKSPACE.devtools,
});
