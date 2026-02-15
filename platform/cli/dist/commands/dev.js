import { run } from "../utils/run.js";
export const registerDevCommands = (program) => {
    const dev = program.command("dev").description("Dev operations");
    dev.command("tunnel").action(() => run("pnpm -w dev:tunnel"));
    dev.action(() => run("pnpm -w dev"));
    dev.command("check").action(() => run("pnpm -w dev:check"));
    dev.command("next").action(() => run("pnpm -w dev:next"));
    dev.command("next:check").action(() => run("pnpm -w dev:next:check"));
    dev.command("seed").action(() => run("pnpm -w dev:seed"));
};
