import { run } from "../utils/run.js";

export const registerInfraCommands = (program) => {
  const infra = program.command("infra").description("Local infrastructure");
  infra.command("up").action(() => run("pnpm -w infra:up"));
  infra.command("down").action(() => run("pnpm -w infra:down"));
  infra.command("restart").action(() => run("pnpm -w infra:restart"));
  infra.command("logs").action(() => run("pnpm -w infra:logs"));
};
