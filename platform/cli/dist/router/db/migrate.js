import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";
export const description = "Migrate schema changes to cloud database based on generated SQL files";
export default turboCommand("db:migrate", { filter: WORKSPACE.db });
