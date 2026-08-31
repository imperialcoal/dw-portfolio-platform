# Required providers and backend

terraform {
  required_version = "~> 1.15.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.24.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.4.1"
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
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.6.2"
    }
  }

  # Terraform state stored in Cloudflare R2
  # Free tier, S3-compatible, no egress fees
  backend "s3" {}
}
