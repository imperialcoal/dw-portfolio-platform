import { execSync } from "node:child_process";

export const run = (cmd: string): void => {
  execSync(cmd, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
};
