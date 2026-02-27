import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";
export const description = "Migrate schema changes to local database based on generated SQL files";
export default turboCommand("db:migrate:local", { filter: WORKSPACE.db });
