#!/usr/bin/env bash
set -euo pipefail

# Usage: doppler run --config stg -- ./scripts/init.sh preview
#        doppler run --config prd -- ./scripts/init.sh production

ENV="${1:-preview}"

terraform init \
	-reconfigure \
	-backend-config="environments/${ENV}/backend.hcl" \
	-backend-config="access_key=${R2_ACCESS_KEY_ID}" \
	-backend-config="secret_key=${R2_SECRET_ACCESS_KEY}" \
	-backend-config="endpoints={s3=\"${R2_ENDPOINT}\"}"
