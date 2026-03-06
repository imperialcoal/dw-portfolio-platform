import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";
export const description = "Seed database with mock data";
export default turboCommand("dev-tools:db:seed", {
    filter: WORKSPACE.devtools,
});
