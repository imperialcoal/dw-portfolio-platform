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
