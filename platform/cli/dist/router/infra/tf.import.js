import * as readline from "readline";
import { execa } from "execa";
export const description = "Import existing infrastructure into Terraform state";
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
    // Doppler secrets — auto-imported, no ID needed
    doppler_upstash_url: "module.doppler.doppler_secret.upstash_rest_url",
    doppler_upstash_token: "module.doppler.doppler_secret.upstash_rest_token",
    doppler_database_url: "module.doppler.doppler_secret.database_url",
    doppler_direct_url: "module.doppler.doppler_secret.direct_url",
    doppler_supabase_ref: "module.doppler.doppler_secret.supabase_project_ref",
    doppler_supabase_publishable_key: "module.doppler.doppler_secret.supabase_publishable_key",
    doppler_supabase_secret_key: "module.doppler.doppler_secret.supabase_secret_key",
};
// Doppler secret import IDs are auto-derived — no manual ID needed
export const DOPPLER_SECRET_IDS = {
    doppler_upstash_url: (c) => `${DOPPLER_PROJECT}.${c}.UPSTASH_REDIS_REST_URL`,
    doppler_upstash_token: (c) => `${DOPPLER_PROJECT}.${c}.UPSTASH_REDIS_REST_TOKEN`,
    doppler_database_url: (c) => `${DOPPLER_PROJECT}.${c}.DATABASE_URL`,
    doppler_direct_url: (c) => `${DOPPLER_PROJECT}.${c}.DIRECT_URL`,
    doppler_supabase_ref: (c) => `${DOPPLER_PROJECT}.${c}.SUPABASE_PROJECT_REF`,
    doppler_supabase_publishable_key: (c) => `${DOPPLER_PROJECT}.${c}.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`,
    doppler_supabase_secret_key: (c) => `${DOPPLER_PROJECT}.${c}.SUPABASE_SECRET_DEFAULT_KEY`,
};
// Known resource IDs — pre-filled defaults for each resource.
// Non-sensitive identifiers; safe to commit.
// Format for Cloudflare: zone_id/record_id
// Format for Vercel:     team_id/project_id/domain
//
// Retrieve Cloudflare record IDs:
//   doppler run --config=prd -- bash -c '
//     curl -s "https://api.cloudflare.com/client/v4/zones/145e64e1bd9e74d45fd610490d6d91fe/dns_records" \
//       -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
//       jq -r ".result[] | [.type, .name, .id] | @tsv"
//   '
const KNOWN_RESOURCE_IDS = {
    // ── Vercel ──────────────────────────────────────────────────────────────
    vercel_preview: "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_gruPExJp4p2E5qiNpplYS8CPrn4c/dev.dw-portfolio.dev",
    vercel_production: "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_gruPExJp4p2E5qiNpplYS8CPrn4c/dw-portfolio.dev",
    vercel_www: "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_gruPExJp4p2E5qiNpplYS8CPrn4c/www.dw-portfolio.dev",
    // ── Cloudflare DNS records (zone: 145e64e1bd9e74d45fd610490d6d91fe) ────
    // A       dw-portfolio.dev
    cloudflare_apex: "145e64e1bd9e74d45fd610490d6d91fe/9f4af4b8284ae30e061d7920c63210d5",
    // CNAME   www.dw-portfolio.dev
    cloudflare_www: "145e64e1bd9e74d45fd610490d6d91fe/c2b1216dc786ab098f7eebf9cff8a174",
    // CNAME   dev.dw-portfolio.dev
    cloudflare_preview: "145e64e1bd9e74d45fd610490d6d91fe/afe5068fcb715b56d42039d2564af312",
    // CNAME   tunnel.dw-portfolio.dev
    cloudflare_tunnel: "145e64e1bd9e74d45fd610490d6d91fe/62ac12fab3cb495dd2aa6ab8d8c669e0",
    // TXT     send.dw-portfolio.dev (SPF)
    cloudflare_spf: "145e64e1bd9e74d45fd610490d6d91fe/94fa4dd05fbeca2a41217797ae703c54",
    // TXT     _dmarc.dw-portfolio.dev
    cloudflare_dmarc: "145e64e1bd9e74d45fd610490d6d91fe/4c2ef94ac0de51f83a17405e15f591f2",
};
// Human-readable hints shown above each prompt for context.
const RESOURCE_ID_HINTS = {
    upstash: "Upstash dashboard → Redis → your DB → Database ID  (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
    supabase: "Supabase dashboard → Settings → General → Reference ID  (16-char alphanumeric)",
    vercel_preview: "Format: team_id/project_id/domain",
    vercel_production: "Format: team_id/project_id/domain",
    vercel_www: "Format: team_id/project_id/domain",
    cloudflare_apex: "Format: zone_id/record_id",
    cloudflare_www: "Format: zone_id/record_id",
    cloudflare_preview: "Format: zone_id/record_id",
    cloudflare_tunnel: "Format: zone_id/record_id",
    cloudflare_spf: "Format: zone_id/record_id",
    cloudflare_dmarc: "Format: zone_id/record_id",
};
// Which resources belong to which environment.
// Preview does not manage DNS or production domains.
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
    await execa("doppler", [
        "run",
        `--config=${dopplerConfig}`,
        "--",
        "./scripts/terraform.sh",
        "import",
        `-var-file=environments/${env}.tfvars`,
        address,
        id,
    ], {
        stdio: "inherit",
        cwd: "platform/infra/terraform",
    });
}
const command = async () => {
    const env = process.env.APP_ENV === "production" ? "production" : "preview";
    const dopplerConfig = env === "production" ? "prd" : "stg";
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
            const id = autoIdFn(dopplerConfig);
            console.log(`\nAuto-importing ${key}...`);
            try {
                await importResource(dopplerConfig, env, address, id);
                console.log(`✓ ${key} imported`);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes("already managed") ||
                    message.includes("already exists")) {
                    console.log(`  ✓ ${key} already in state — skipping`);
                }
                else {
                    console.error(`  ✗ ${key} failed: ${message}`);
                    const retry = await prompt("Continue with remaining resources? (y/n): ");
                    if (retry.toLowerCase() !== "y") {
                        process.exit(1);
                    }
                }
            }
            continue;
        }
        // Infrastructure resources require manual ID entry.
        // Print the format hint and pre-filled ID (if known) before prompting.
        const hint = RESOURCE_ID_HINTS[key];
        const knownId = KNOWN_RESOURCE_IDS[key];
        if (hint) {
            console.log(`\n  ℹ ${key}: ${hint}`);
        }
        if (knownId) {
            console.log(`  ✦ Known ID: ${knownId}`);
        }
        const promptText = knownId
            ? `ID for ${key} (Enter to use known ID, or paste to override): `
            : `ID for ${key} (Enter to skip): `;
        const input = await prompt(promptText);
        const id = (input || knownId) ?? "";
        if (!id) {
            console.log(`Skipping ${key}`);
            continue;
        }
        try {
            await importResource(dopplerConfig, env, address, id);
            console.log(`✓ ${key} imported successfully`);
        }
        catch {
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
