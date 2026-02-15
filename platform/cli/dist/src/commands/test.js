// NOTE: testing still remains in root package.json for now until CLI stabalizes
import { run } from "../utils/run.js";
export const registerTestCommands = (program) => {
    const test = program.command("test").description("Test operations");
    test.command("runtime").action(() => run("pnpm -w test:runtime"));
    test.command("api:infra").action(() => run("pnpm -w test:api:infra"));
    test.command("setup").action(() => run("pnpm -w test:setup"));
};
