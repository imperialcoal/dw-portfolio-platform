import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";
export const description = "Run visual control panel (GUI) for local database data";
export default turboCommand("db:studio:local", { filter: WORKSPACE.db });
