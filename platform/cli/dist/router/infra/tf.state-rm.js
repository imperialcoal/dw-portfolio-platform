import { execa } from "execa";
import { prompt } from "../../utils/prompt.js";
import { RESOURCES } from "./tf.resources.js";
export const description = "Remove infrastructure resources from Terraform state";
const command = async () => {
    const env = process.env.APP_ENV === "production" ? "production" : "preview";
    const dopplerConfig = env === "production" ? "prd" : "stg";
    console.log(`\nTerraform State Removal — ${env}`);
    console.log("─".repeat(50));
    const keys = Object.keys(RESOURCES);
    keys.forEach((key, i) => {
        console.log(`${i + 1}. ${key}`);
    });
    const answer = await prompt("\nSelect resource number to remove: ");
    const index = Number(answer) - 1;
    if (Number.isNaN(index) || !keys[index]) {
        console.error("Invalid selection.");
        process.exit(1);
    }
    const key = keys[index];
    const address = RESOURCES[key];
    console.log(`\nRemoving ${address} from Terraform state...\n`);
    await execa("doppler", [
        "run",
        `--config=${dopplerConfig}`,
        "--",
        "./scripts/terraform.sh",
        "state",
        "rm",
        address,
    ], {
        stdio: "inherit",
        cwd: "platform/infra/terraform",
    });
    console.log(`\n✓ ${key} removed from Terraform state`);
};
export default command;
