# Required providers and backend

terraform {
  required_version = "~> 1.15.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.21.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.3.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 2.1.0"
    }
    doppler = {
      source  = "DopplerHQ/doppler"
      version = "~> 1.21.3"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.9.1"
    }
  }

  # Terraform state stored in Cloudflare R2
  # Free tier, S3-compatible, no egress fees
  backend "s3" {}
}
