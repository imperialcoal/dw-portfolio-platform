# platform/infra

Terraform infrastructure-as-code for all cloud resources. Provisions and manages Vercel, Cloudflare, Supabase, Upstash (Redis + QStash), and Doppler resources declaratively. Terraform state is stored in Cloudflare R2 (S3-compatible backend).

## Purpose

Ensures all cloud infrastructure is version-controlled, reproducible, and auditable. All provider credentials are injected at plan/apply time via Doppler or local environment variables — nothing is committed to the repository.

## Architecture

```
terraform/
├── main.tf           # Provider configuration + module composition
├── terraform.tf      # Provider version locks + R2 backend configuration
├── variables.tf      # Input variable declarations
├── outputs.tf        # Output value declarations
├── environments/     # Per-environment variable files (.tfvars)
└── modules/
    ├── cloudflare/   # DNS records + tunnel CNAME
    ├── vercel/       # Project + domain + env var sync
    ├── upstash/      # Redis database + QStash configuration
    ├── supabase/     # Database project provisioning
    └── doppler/      # Secret sync from Upstash/Supabase outputs → Doppler configs
```

### Module Composition

The `doppler` module receives outputs from `upstash` and `supabase` modules and syncs connection strings into Doppler as secrets. This means provisioning a new environment automatically populates all database and cache URLs in the secret manager — no manual copy-paste.

## Terraform Providers

| Provider | Version | Purpose |
|---|---|---|
| `cloudflare/cloudflare` | ~5.18.0 | DNS management, R2 backend |
| `vercel/vercel` | ~4.6.1 | Vercel project and deployment settings |
| `upstash/upstash` | ~2.1.0 | Redis databases, QStash topics |
| `supabase/supabase` | ~1.7.0 | PostgreSQL project provisioning |
| `DopplerHQ/doppler` | ~1.21.1 | Secret sync and config management |

## Usage

```bash
# Initialize (downloads providers, configures R2 backend)
pnpm dw infra tf.init

# Plan changes (dry run)
pnpm dw infra tf.plan

# Apply changes
pnpm dw infra tf.apply

# Import an existing resource into state
pnpm dw infra tf.import

# Remove a resource from state (without destroying it)
pnpm dw infra tf.state-rm
```

All Terraform commands run via `pnpm dw infra tf.*` which injects provider credentials from the current environment (Doppler or `.env.local`).

## Required Variables

| Variable | Purpose |
|---|---|
| `cloudflare_api_token` | Cloudflare provider auth |
| `cloudflare_zone_id` | DNS zone for `dw-portfolio.dev` |
| `vercel_api_token` | Vercel provider auth |
| `vercel_project_id` | Target Vercel project |
| `upstash_email` | Upstash account email |
| `upstash_api_key` | Upstash Management API key |
| `supabase_access_token` | Supabase CLI token |
| `supabase_org_id` | Supabase organization ID |
| `supabase_db_password` | Database password for new projects |
| `doppler_token` | Doppler service account token |
| `environment` | `production` or `preview` |

## Developer Notes

> **Developer Note**
> Terraform state is in a Cloudflare R2 bucket using the `backend "s3" {}` block with no inline configuration. The backend configuration (bucket name, endpoint, credentials) is provided via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`) at `terraform init` time. This avoids committing backend config that contains account-specific R2 endpoints.
