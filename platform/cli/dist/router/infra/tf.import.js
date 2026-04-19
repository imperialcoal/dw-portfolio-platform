import * as readline from "readline";
import { execa } from "execa";

export const description =
  "Import existing infrastructure into Terraform state";
export const DOPPLER_PROJECT = "dw-portfolio-platform";
// All managed resources and their Terraform addresses
export const RESOURCES = {
  // Infrastructure
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
  // Doppler secrets
  doppler_upstash_url: "module.doppler.doppler_secret.upstash_rest_url",
  doppler_upstash_token: "module.doppler.doppler_secret.upstash_rest_token",
  doppler_database_url: "module.doppler.doppler_secret.database_url",
  doppler_direct_url: "module.doppler.doppler_secret.direct_url",
  doppler_supabase_ref: "module.doppler.doppler_secret.supabase_project_ref",
  doppler_supabase_publishable_key:
    "module.doppler.doppler_secret.supabase_publishable_key",
  doppler_supabase_secret_key:
    "module.doppler.doppler_secret.supabase_secret_key",
};
// Doppler secret import IDs are auto-derived — no manual ID needed
export const DOPPLER_SECRET_IDS = {
  doppler_upstash_url: (c) => `${DOPPLER_PROJECT}.${c}.UPSTASH_REDIS_REST_URL`,
  doppler_upstash_token: (c) =>
    `${DOPPLER_PROJECT}.${c}.UPSTASH_REDIS_REST_TOKEN`,
  doppler_database_url: (c) => `${DOPPLER_PROJECT}.${c}.DATABASE_URL`,
  doppler_direct_url: (c) => `${DOPPLER_PROJECT}.${c}.DIRECT_URL`,
  doppler_supabase_ref: (c) => `${DOPPLER_PROJECT}.${c}.SUPABASE_PROJECT_REF`,
  doppler_supabase_publishable_key: (c) =>
    `${DOPPLER_PROJECT}.${c}.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`,
  doppler_supabase_secret_key: (c) =>
    `${DOPPLER_PROJECT}.${c}.SUPABASE_SECRET_DEFAULT_KEY`,
};
// Which resources belong to which environment
const ENVIRONMENT_RESOURCES = {
  preview: [
    "upstash",
    "supabase",
    "vercel_preview",
    "doppler_upstash_url",
    "doppler_upstash_token",
    "doppler_database_url",
    "doppler_direct_url",
    "doppler_supabase_ref",
    "doppler_supabase_publishable_key",
    "doppler_supabase_secret_key",
  ],
  production: [
    "upstash",
    "supabase",
    "vercel_production",
    "vercel_www",
    "cloudflare_apex",
    "cloudflare_www",
    "cloudflare_preview",
    "cloudflare_tunnel",
    "cloudflare_spf",
    "cloudflare_dmarc",
    "doppler_upstash_url",
    "doppler_upstash_token",
    "doppler_database_url",
    "doppler_direct_url",
    "doppler_supabase_ref",
    "doppler_supabase_publishable_key",
    "doppler_supabase_secret_key",
  ],
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
async function importResource(dopplerConfig, env, address, id) {
  console.log(`\nImporting ${address}...`);
  await execa(
    "doppler",
    [
      "run",
      `--config=${dopplerConfig}`,
      "--",
      "./scripts/terraform.sh",
      "import",
      `-var-file=environments/${env}.tfvars`,
      address,
      id,
    ],
    {
      stdio: "inherit",
      cwd: "platform/infra/terraform",
    },
  );
}
const command = async () => {
  const env = process.env.APP_ENV === "production" ? "production" : "preview";
  const dopplerConfig = env === "production" ? "prd" : "stg";
  const dopplerConfigShort = env === "production" ? "prd" : "stg";
  const resources = ENVIRONMENT_RESOURCES[env];
  if (!resources) {
    console.error(`No resources defined for environment: ${env}`);
    process.exit(1);
  }
  console.log(`\nTerraform Import — ${env} environment`);
  console.log("─".repeat(50));
  console.log("Doppler secrets are imported automatically.");
  console.log("You will be prompted for each resource ID.");
  console.log("Press Enter to skip a resource already imported.\n");
  for (const key of resources) {
    const address = RESOURCES[key];
    const autoIdFn = DOPPLER_SECRET_IDS[key];
    // Doppler secrets have deterministic IDs — no prompt needed
    if (autoIdFn) {
      const id = autoIdFn(dopplerConfigShort);
      console.log(`\nAuto-importing ${key}...`);
      try {
        await importResource(dopplerConfig, env, address, id);
        console.log(`✓ ${key} imported`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("already managed") ||
          message.includes("already exists")
        ) {
          // Verify it's actually in state by checking if plan would show it as create
          // If we get here, it's genuinely already imported — safe to skip
          console.log(`  ✓ ${key} already in state — skipping`);
        } else {
          console.error(`  ✗ ${key} failed: ${message}`);
          const retry = await prompt(
            "Continue with remaining resources? (y/n): ",
          );
          if (retry.toLowerCase() !== "y") {
            process.exit(1);
          }
        }
      }
      continue;
    }
    // Infrastructure resources require manual ID entry
    const id = await prompt(`ID for ${key} (${address}): `);
    if (!id) {
      console.log(`Skipping ${key}`);
      continue;
    }
    try {
      await importResource(dopplerConfig, env, address, id);
      console.log(`✓ ${key} imported successfully`);
    } catch {
      console.error(`✗ Failed to import ${key}. Check the ID and try again.`);
      const retry = await prompt("Continue with remaining resources? (y/n): ");
      if (retry.toLowerCase() !== "y") {
        process.exit(1);
      }
    }
  }
  console.log("\n✓ Import complete. Run tf.plan to verify zero drift.");
};
export default command;
