import { execa } from "execa";

export const description =
  "Initialize Terraform backend for current environment";
const command = async () => {
  const env = process.env.APP_ENV === "production" ? "production" : "preview";
  const dopplerConfig = env === "production" ? "prd" : "stg";
  return execa(
    "doppler",
    ["run", `--config=${dopplerConfig}`, "--", "./scripts/init.sh", env],
    {
      stdio: "inherit",
      cwd: "platform/infra/terraform",
    },
  );
};
export default command;
