import * as readline from "readline";
import { execa } from "execa";
export const description = "Remove infrastructure resources from Terraform state";
const RESOURCES = {
    upstash: "module.upstash.upstash_redis_database.main",
    supabase: "module.supabase.supabase_project.main",
    vercel_preview: "module.vercel.vercel_project_domain.preview[0]",
    vercel_production: "module.vercel.vercel_project_domain.production[0]",
    vercel_www: "module.vercel.vercel_project_domain.www[0]",
    cloudflare_apex: "module.cloudflare.cloudflare_dns_record.apex[0]",
    cloudflare_www: "module.cloudflare.cloudflare_dns_record.www[0]",
    cloudflare_preview: "module.cloudflare.cloudflare_dns_record.preview[0]",
    cloudflare_tunnel: "module.cloudflare.cloudflare_dns_record.tunnel[0]",
    cloudflare_spf: "module.cloudflare.cloudflare_dns_record.spf[0]",
    cloudflare_dmarc: "module.cloudflare.cloudflare_dns_record.dmarc[0]",
};
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
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
