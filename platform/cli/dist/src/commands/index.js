import { registerDbCommands } from "./db.js";
import { registerDevCommands } from "./dev.js";
import { registerInfraCommands } from "./infra.js";
// NOTE: testing still remains in root package.json for now until CLI stabalizes
// import { registerTestCommands } from "./commands/test";
export const registerCommands = (program) => {
    registerDevCommands(program);
    registerDbCommands(program);
    registerInfraCommands(program);
    // registerTestCommands(program);
};
