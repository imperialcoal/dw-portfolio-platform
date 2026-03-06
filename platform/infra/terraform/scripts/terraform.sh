#!/usr/bin/env bash
set -euo pipefail

# Maps Doppler secrets to Terraform variables
# Run via: doppler run --config stg -- ./scripts/terraform.sh <command>

export TF_VAR_cloudflare_api_token="$CLOUDFLARE_API_TOKEN"
export TF_VAR_vercel_api_token="$VERCEL_API_TOKEN"
export TF_VAR_upstash_api_key="$UPSTASH_API_KEY"
export TF_VAR_supabase_access_token="$SUPABASE_ACCESS_TOKEN"
export TF_VAR_supabase_db_password="$SUPABASE_DB_PASSWORD"
export TF_VAR_doppler_token="$DOPPLER_TOKEN"

terraform "$@"
