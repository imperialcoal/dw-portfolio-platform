import { execa } from "execa";

export const description = "Preview Terraform infrastructure changes";
const command = async () => {
  const env = process.env.APP_ENV === "production" ? "production" : "preview";
  const dopplerConfig = env === "production" ? "prd" : "stg";
  return execa(
    "doppler",
    [
      "run",
      `--config=${dopplerConfig}`,
      "--",
      "./scripts/terraform.sh",
      "plan",
      `-var-file=environments/${env}.tfvars`,
    ],
    {
      stdio: "inherit",
      cwd: "platform/infra/terraform",
    },
  );
};
export default command;
