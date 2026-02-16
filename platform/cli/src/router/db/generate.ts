import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";

export const description = "Generate TypeScript schema changes into SQL files";

export default turboCommand("db:generate", { filter: WORKSPACE.db });
