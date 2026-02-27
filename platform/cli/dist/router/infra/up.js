import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";
export const description = "Start Docker for local development";
export default turboCommand("dev-tools:infra:up", {
    filter: WORKSPACE.devtools,
});
