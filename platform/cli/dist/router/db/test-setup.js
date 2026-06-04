import { turboCommand } from "../../utils/turbo-command.js";
import { WORKSPACE } from "../../utils/workspace.js";

export const description = "Setup test database for testing";
export default turboCommand("dev-tools:db:test-setup", {
  filter: WORKSPACE.devtools,
});
