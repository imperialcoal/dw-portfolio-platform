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

provider "railway" {
  token = var.railway_api_token
}

# ── Modules ───────────────────────────────────────────────────────────────────

module "cloudflare" {
  source                           = "./modules/cloudflare"
  zone_id                          = var.cloudflare_zone_id
  tunnel_cname_target              = var.tunnel_cname_target
  environment                      = var.environment
  railway_resume_api_cname_target  = var.railway_resume_api_cname_target
  railway_career_data_cname_target = var.railway_career_data_cname_target
}

module "vercel_platform" {
  source            = "./modules/vercel"
  project_id        = var.vercel_project_id
  project_name      = "dw-portfolio-platform"
  team_id           = var.vercel_team_id
  environment       = var.environment
  production_domain = "dw-portfolio.dev"
  preview_domain    = "dev.dw-portfolio.dev"
  www_domain        = "www.dw-portfolio.dev"
}

module "vercel_home" {
  source            = "./modules/vercel"
  project_id        = var.vercel_home_project_id
  project_name      = "dw-portfolio-platform-home"
  team_id           = var.vercel_team_id
  environment       = var.environment
  production_domain = "portfolio.dw-portfolio.dev"
  preview_domain    = "dev.portfolio.dw-portfolio.dev"
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

  upstash_rest_url         = module.upstash.rest_url
  upstash_rest_token       = module.upstash.rest_token
  supabase_db_url          = module.supabase.database_url
  supabase_direct_url      = module.supabase.direct_url
  supabase_project_ref     = module.supabase.project_ref
  supabase_publishable_key = module.supabase.publishable_key
  supabase_secret_key      = module.supabase.secret_key
}

module "railway" {
  source      = "./modules/railway"
  environment = var.environment
}
