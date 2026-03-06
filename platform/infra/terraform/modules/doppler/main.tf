locals {
  # Maps environment to Doppler config name
  doppler_config = var.environment == "production" ? "prd" : "stg"
}

resource "doppler_secret" "upstash_rest_url" {
  project = "dw-portfolio-platform"
  config  = local.doppler_config
  name    = "UPSTASH_REDIS_REST_URL"
  value   = var.upstash_rest_url
}

resource "doppler_secret" "upstash_rest_token" {
  project = "dw-portfolio-platform"
  config  = local.doppler_config
  name    = "UPSTASH_REDIS_REST_TOKEN"
  value   = var.upstash_rest_token
}

resource "doppler_secret" "database_url" {
  project = "dw-portfolio-platform"
  config  = local.doppler_config
  name    = "DATABASE_URL"
  value   = var.supabase_db_url
}

resource "doppler_secret" "direct_url" {
  project = "dw-portfolio-platform"
  config  = local.doppler_config
  name    = "DIRECT_URL"
  value   = var.supabase_direct_url
}

resource "doppler_secret" "supabase_project_ref" {
  project = "dw-portfolio-platform"
  config  = local.doppler_config
  name    = "SUPABASE_PROJECT_REF"
  value   = var.supabase_project_ref
}

resource "doppler_secret" "supabase_publishable_key" {
  project = "dw-portfolio-platform"
  config  = local.doppler_config
  name    = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
  value   = var.supabase_publishable_key
}

resource "doppler_secret" "supabase_secret_key" {
  project = "dw-portfolio-platform"
  config  = local.doppler_config
  name    = "SUPABASE_SECRET_DEFAULT_KEY"
  value   = var.supabase_secret_key
}
