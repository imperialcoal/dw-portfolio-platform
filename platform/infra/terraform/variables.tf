# Input variables

# ── Environment ──────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment: preview or production"
  type        = string
  validation {
    condition     = contains(["preview", "production"], var.environment)
    error_message = "Must be preview or production."
  }
}

# ── Cloudflare ────────────────────────────────────────────────────────────────

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for dw-portfolio.dev"
  type        = string
}

variable "tunnel_cname_target" {
  description = "CNAME target for Cloudflare tunnel subdomain"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS edit permissions"
  type        = string
  sensitive   = true
}

# ── Vercel ────────────────────────────────────────────────────────────────────

variable "vercel_project_id" {
  description = "Vercel project ID"
  type        = string
}

variable "vercel_home_project_id" {
  description = "Vercel project ID for dw-portfolio-platform-home (Astro portfolio)"
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team ID — empty string for personal accounts"
  type        = string
  default     = ""
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

# ── Upstash ───────────────────────────────────────────────────────────────────

variable "upstash_email" {
  description = "Upstash account email"
  type        = string
}

variable "upstash_api_key" {
  description = "Upstash API key"
  type        = string
  sensitive   = true
}

# ── Supabase ──────────────────────────────────────────────────────────────────

variable "supabase_org_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "supabase_access_token" {
  description = "Supabase personal access token"
  type        = string
  sensitive   = true
}

variable "supabase_db_password" {
  description = "Supabase database password"
  type        = string
  sensitive   = true
}

# ── Doppler ───────────────────────────────────────────────────────────────────

variable "doppler_token" {
  description = "Doppler service token scoped to target config"
  type        = string
  sensitive   = true
}

# ── Railway ───────────────────────────────────────────────────────────────────

variable "railway_api_token" {
  description = "Railway API token"
  type        = string
  sensitive   = true
}

variable "railway_resume_api_cname_target" {
  description = "CNAME target Railway issued for dev.resume-api.dw-portfolio.dev — sourced manually from the Railway dashboard, provider cannot read it back"
  type        = string
}

variable "railway_career_data_cname_target" {
  description = "CNAME target Railway issued for dev.career-data.dw-portfolio.dev — sourced manually from the Railway dashboard, provider cannot read it back"
  type        = string
}
