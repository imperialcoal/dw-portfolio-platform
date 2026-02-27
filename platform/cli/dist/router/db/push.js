import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";

export const description = "Push database schema to cloud database";
export default turboCommand("db:push", { filter: WORKSPACE.db });
