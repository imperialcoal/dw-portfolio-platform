import { execa } from "execa";
import { DOPPLER_SECRET_IDS, RESOURCES } from "./tf.resources.js";
// Example usage:
// RESOURCE=doppler_supabase_publishable_key APP_ENV=preview pnpm dw infra tf.import.single
// RESOURCE=doppler_supabase_secret_key APP_ENV=preview pnpm dw infra tf.import.single
export const description = "Import a single resource into Terraform state";
const validKeys = Object.keys(RESOURCES);
const command = async () => {
    const env = process.env.APP_ENV === "production" ? "production" : "preview";
    const dopplerConfig = env === "production" ? "prd" : "stg";
    const rawKey = process.env.RESOURCE;
    const resourceId = process.env.RESOURCE_ID;
    if (!rawKey || !validKeys.includes(rawKey)) {
        console.error(`RESOURCE environment variable required. Valid values:\n${validKeys.join("\n")}`);
        process.exit(1);
    }
    const key = rawKey;
    const address = RESOURCES[key];
    const autoIdFn = DOPPLER_SECRET_IDS[key];
    const resolvedId = autoIdFn ? autoIdFn(dopplerConfig) : resourceId;
    if (!resolvedId) {
        console.error(`RESOURCE_ID required for non-Doppler resources`);
        process.exit(1);
    }
    console.log(`\nImporting ${key} → ${address}`);
    await execa("doppler", [
        "run",
        `--config=${dopplerConfig}`,
        "--",
        "./scripts/terraform.sh",
        "import",
        `-var-file=environments/${env}.tfvars`,
        address,
        resolvedId,
    ], { stdio: "inherit", cwd: "platform/infra/terraform" });
    console.log(`✓ ${key} imported successfully`);
};
export default command;
