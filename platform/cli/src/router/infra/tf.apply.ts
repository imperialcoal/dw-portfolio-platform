import { execa } from "execa";

import type { CLICommand } from "../../types/command.js";

export const description = "Apply Terraform infrastructure changes";

const command: CLICommand = async () => {
  const env = process.env.APP_ENV === "production" ? "production" : "preview";
  const dopplerConfig = env === "production" ? "prd" : "stg";

  return execa(
    "doppler",
    [
      "run",
      `--config=${dopplerConfig}`,
      "--",
      "./scripts/terraform.sh",
      "apply",
      `-var-file=environments/${env}.tfvars`,
    ],
    {
      stdio: "inherit",
      cwd: "platform/infra/terraform",
    },
  );
};

export default command;
