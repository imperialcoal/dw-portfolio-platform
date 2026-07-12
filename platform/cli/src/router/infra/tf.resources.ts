// Centralized Terraform resource registry.
//
// Single source of truth for every CLI command that operates on individual
// Terraform resource addresses: tf.import, tf.import.single, tf.apply.target,
// tf.state-rm. Update an address here ONCE — every consumer picks it up.
// This file replaces three previously hand-copied RESOURCES/TARGETS objects
// that had already drifted out of sync with each other once (the
// module.vercel → module.vercel_platform rename).

export const DOPPLER_PROJECT = "dw-portfolio-platform";

export const RESOURCES = {
  // ── Infrastructure ──────────────────────────────────────────────────────
  upstash: "module.upstash.upstash_redis_database.main",
  supabase: "module.supabase.supabase_project.main",
  vercel_preview: "module.vercel_platform.vercel_project_domain.preview[0]",
  vercel_production:
    "module.vercel_platform.vercel_project_domain.production[0]",
  vercel_www: "module.vercel_platform.vercel_project_domain.www[0]",
  vercel_home_preview: "module.vercel_home.vercel_project_domain.preview[0]",
  vercel_home_production:
    "module.vercel_home.vercel_project_domain.production[0]",
  cloudflare_apex: "module.cloudflare.cloudflare_dns_record.apex[0]",
  cloudflare_www: "module.cloudflare.cloudflare_dns_record.www[0]",
  cloudflare_preview: "module.cloudflare.cloudflare_dns_record.preview[0]",
  cloudflare_portfolio: "module.cloudflare.cloudflare_dns_record.portfolio[0]",
  cloudflare_dev_portfolio:
    "module.cloudflare.cloudflare_dns_record.dev_portfolio[0]",
  cloudflare_resume_api:
    "module.cloudflare.cloudflare_dns_record.resume_api[0]",
  cloudflare_career_data:
    "module.cloudflare.cloudflare_dns_record.career_data[0]",
  cloudflare_tunnel: "module.cloudflare.cloudflare_dns_record.tunnel[0]",
  cloudflare_spf: "module.cloudflare.cloudflare_dns_record.spf[0]",
  cloudflare_dmarc: "module.cloudflare.cloudflare_dns_record.dmarc[0]",
  // ── Railway (preview state only — see modules/railway/main.tf gate) ─────
  railway_project: "module.railway.railway_project.main[0]",
  // ── Doppler secrets ─────────────────────────────────────────────────────
  doppler_upstash_url: "module.doppler.doppler_secret.upstash_rest_url",
  doppler_upstash_token: "module.doppler.doppler_secret.upstash_rest_token",
  doppler_database_url: "module.doppler.doppler_secret.database_url",
  doppler_direct_url: "module.doppler.doppler_secret.direct_url",
  doppler_supabase_ref: "module.doppler.doppler_secret.supabase_project_ref",
  doppler_supabase_publishable_key:
    "module.doppler.doppler_secret.supabase_publishable_key",
  doppler_supabase_secret_key:
    "module.doppler.doppler_secret.supabase_secret_key",
} as const;

export type ResourceKey = keyof typeof RESOURCES;

// Resolves a known ID that differs between Terraform environments — used
// only for resources that are genuinely separate physical objects per
// environment (Upstash, Supabase), unlike Cloudflare/Vercel/Railway
// resources, which are domain-global or preview-only singletons and never
// need this. Object form (not positional args) so preview/production can't
// get silently transposed.
function byEnv(ids: { preview: string; production: string }) {
  return (env: string) => (env === "production" ? ids.production : ids.preview);
}

// Doppler secret import IDs are auto-derived — no manual ID needed.
export const DOPPLER_SECRET_IDS: Partial<
  Record<ResourceKey, (config: string) => string>
> = {
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

// Known resource IDs — pre-filled defaults for each resource.
// Most values are plain strings (true singletons). upstash/supabase use
// byEnv() because they're separate real projects in preview vs production —
// see byEnv's comment above for why a flat string would be actively wrong.
// Non-sensitive identifiers; safe to commit.
// Format for Cloudflare: zone_id/record_id
// Format for Vercel:     team_id/project_id/domain
// Format for railway_custom_domain: project_id:environment_name:domain
//   NOTE: "environment_name" here is Railway's own environment concept
//   (literally named "production" in modules/railway/main.tf's
//   default_environment block) — unrelated to, and confusingly identical
//   in name to, our Terraform preview/production split. This module's
//   resources live entirely in the *preview* Terraform state.
//
// Retrieve Cloudflare record IDs:
//   doppler run --config=prd -- bash -c '
//     curl -s "https://api.cloudflare.com/client/v4/zones/145e64e1bd9e74d45fd610490d6d91fe/dns_records" \
//       -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
//       jq -r ".result[] | [.type, .name, .id] | @tsv"
//   '
// Retrieve Railway service IDs:
//   doppler run --config=stg -- bash -c '
//     curl -s https://backboard.railway.com/graphql/v2 \
//       -H "Authorization: Bearer $RAILWAY_API_TOKEN" \
//       -H "Content-Type: application/json" \
//       -d "{\"query\":\"query { project(id: \\\"<project_id>\\\") { services { edges { node { id name } } } } }\"}" \
//     | jq -r ".data.project.services.edges[].node | [.name, .id] | @tsv"
//   '
export const KNOWN_RESOURCE_IDS: Partial<
  Record<ResourceKey, string | ((env: string) => string)>
> = {
  // ── Upstash / Supabase (env-varying) ─────────────────────────────────────
  upstash: byEnv({
    preview: "aceba7d1-933e-4fcd-ab66-e63cd538b4d5", // dw-portfolio-preview
    production: "c78fe867-8b84-455c-b665-383db6f0295d", // dw-portfolio-production
  }),
  supabase: byEnv({
    preview: "akbwxhwpvpwvbpevowmr", // dw-portfolio-preview
    production: "ykmjoyxpcvalqqzahmuc", // dw-portfolio-production
  }),
  // ── Vercel ──────────────────────────────────────────────────────────────
  vercel_preview:
    "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_gruPExJp4p2E5qiNpplYS8CPrn4c/dev.dw-portfolio.dev",
  vercel_production:
    "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_gruPExJp4p2E5qiNpplYS8CPrn4c/dw-portfolio.dev",
  vercel_www:
    "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_gruPExJp4p2E5qiNpplYS8CPrn4c/www.dw-portfolio.dev",
  vercel_home_preview:
    "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_WPaRoz5atNtcPTlYg5lzJ9eT4JJU/dev.portfolio.dw-portfolio.dev",
  vercel_home_production:
    "team_Jmi4R7XA5pi7uK4Br6j9IJkg/prj_WPaRoz5atNtcPTlYg5lzJ9eT4JJU/portfolio.dw-portfolio.dev",
  // ── Cloudflare DNS records (zone: 145e64e1bd9e74d45fd610490d6d91fe) ────
  cloudflare_apex:
    "145e64e1bd9e74d45fd610490d6d91fe/9f4af4b8284ae30e061d7920c63210d5",
  cloudflare_www:
    "145e64e1bd9e74d45fd610490d6d91fe/c2b1216dc786ab098f7eebf9cff8a174",
  cloudflare_preview:
    "145e64e1bd9e74d45fd610490d6d91fe/afe5068fcb715b56d42039d2564af312",
  cloudflare_portfolio: "",
  cloudflare_dev_portfolio:
    "145e64e1bd9e74d45fd610490d6d91fe/4da31557b75ca0094516581b81b763a2",
  cloudflare_resume_api:
    "145e64e1bd9e74d45fd610490d6d91fe/6e0099be12ea99a62b8d76d3cd5709f2",
  cloudflare_career_data:
    "145e64e1bd9e74d45fd610490d6d91fe/dd1676b62fa0384f6ed545a3a9655688",
  cloudflare_tunnel:
    "145e64e1bd9e74d45fd610490d6d91fe/62ac12fab3cb495dd2aa6ab8d8c669e0",
  cloudflare_spf:
    "145e64e1bd9e74d45fd610490d6d91fe/94fa4dd05fbeca2a41217797ae703c54",
  cloudflare_dmarc:
    "145e64e1bd9e74d45fd610490d6d91fe/4c2ef94ac0de51f83a17405e15f591f2",
  // ── Railway ──────────────────────────────────────────────────────────────
  railway_project: "62571bd9-6fad-4015-b4b3-b5ec4bc48852",
};

// Human-readable hints shown above each prompt for context.
export const RESOURCE_ID_HINTS: Partial<Record<ResourceKey, string>> = {
  upstash:
    "Upstash dashboard → Redis → your DB → Database ID  (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
  supabase:
    "Supabase dashboard → Settings → General → Reference ID  (16-char alphanumeric)",
  vercel_preview: "Format: team_id/project_id/domain",
  vercel_production: "Format: team_id/project_id/domain",
  vercel_www: "Format: team_id/project_id/domain",
  vercel_home_preview: "Format: team_id/project_id/domain",
  vercel_home_production: "Format: team_id/project_id/domain",
  cloudflare_apex: "Format: zone_id/record_id",
  cloudflare_www: "Format: zone_id/record_id",
  cloudflare_preview: "Format: zone_id/record_id",
  cloudflare_portfolio:
    "Format: zone_id/record_id — may not exist yet, check first",
  cloudflare_dev_portfolio:
    "Format: zone_id/record_id — may not exist yet, check first",
  cloudflare_resume_api: "Format: zone_id/record_id",
  cloudflare_career_data: "Format: zone_id/record_id",
  cloudflare_tunnel: "Format: zone_id/record_id",
  cloudflare_spf: "Format: zone_id/record_id",
  cloudflare_dmarc: "Format: zone_id/record_id",
  railway_project: "Railway dashboard → project → Cmd/Ctrl+K → copy project ID",
};

// Which resources belong to which environment.
export const ENVIRONMENT_RESOURCES: Record<string, ResourceKey[]> = {
  preview: [
    "upstash",
    "supabase",
    "vercel_preview",
    "vercel_home_preview",
    "railway_project",
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
    "vercel_home_production",
    "cloudflare_apex",
    "cloudflare_www",
    "cloudflare_preview",
    "cloudflare_portfolio",
    "cloudflare_dev_portfolio",
    "cloudflare_resume_api",
    "cloudflare_career_data",
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

// Preset groups for tf.apply.target — common multi-resource operations.
export const PRESETS: Record<string, ResourceKey[]> = {
  "supabase+doppler": [
    "supabase",
    "doppler_database_url",
    "doppler_direct_url",
    "doppler_supabase_ref",
    "doppler_supabase_publishable_key",
    "doppler_supabase_secret_key",
  ],
  "upstash+doppler": [
    "upstash",
    "doppler_upstash_url",
    "doppler_upstash_token",
  ],
};
