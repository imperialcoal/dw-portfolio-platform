# Required providers and backend

terraform {
  required_version = "~> 1.14.6"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.18.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.6.1"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 2.1.0"
    }
    doppler = {
      source  = "DopplerHQ/doppler"
      version = "~> 1.21.1"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.7.0"
    }    
  }

  # Terraform state stored in Cloudflare R2
  # Free tier, S3-compatible, no egress fees
  backend "s3" {}
}