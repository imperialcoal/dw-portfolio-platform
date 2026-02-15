import { execSync } from "node:child_process";

export const run = (cmd) => {
  execSync(cmd, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
};
