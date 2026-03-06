# Provider configuration

# ── Providers ─────────────────────────────────────────────────────────────────

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id != "" ? var.vercel_team_id : null
}

provider "upstash" {
  email   = var.upstash_email
  api_key = var.upstash_api_key
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "doppler" {
  doppler_token = var.doppler_token
}

# ── Modules ───────────────────────────────────────────────────────────────────

module "cloudflare" {
  source              = "./modules/cloudflare"
  zone_id             = var.cloudflare_zone_id
  tunnel_cname_target = var.tunnel_cname_target
  environment         = var.environment
}

module "vercel" {
  source       = "./modules/vercel"
  project_id   = var.vercel_project_id
  team_id      = var.vercel_team_id
  environment  = var.environment
}

module "upstash" {
  source      = "./modules/upstash"
  environment = var.environment
}

module "supabase" {
  source      = "./modules/supabase"
  org_id      = var.supabase_org_id
  environment = var.environment
  db_password = var.supabase_db_password
}

module "doppler" {
  source      = "./modules/doppler"
  environment = var.environment

  upstash_rest_url          = module.upstash.rest_url
  upstash_rest_token        = module.upstash.rest_token
  supabase_db_url           = module.supabase.database_url
  supabase_direct_url       = module.supabase.direct_url
  supabase_project_ref      = module.supabase.project_ref
  supabase_publishable_key  = module.supabase.publishable_key
  supabase_secret_key = module.supabase.secret_key
}
