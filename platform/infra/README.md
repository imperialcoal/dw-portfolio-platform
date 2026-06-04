# platform/infra

Terraform infrastructure-as-code for all cloud resources. Provisions and manages Vercel, Cloudflare, Supabase, Upstash (Redis), and Doppler resources declaratively. Terraform state is stored in Cloudflare R2 (S3-compatible backend).

## Purpose

Ensures all cloud infrastructure is version-controlled, reproducible, and auditable. All provider credentials are injected at plan/apply time via Doppler — nothing sensitive is committed to the repository.

## Architecture

```
terraform/
├── main.tf                   # Provider configuration + module composition
├── terraform.tf              # Provider version locks + R2 backend
├── variables.tf              # Input variable declarations
├── outputs.tf                # Output value declarations
├── scripts/
│   ├── init.sh               # Backend init with R2 credentials
│   └── terraform.sh          # Maps Doppler secrets → TF_VAR_* env vars
├── environments/
│   ├── preview/backend.hcl   # R2 state key: preview/terraform.tfstate
│   ├── production/backend.hcl # R2 state key: production/terraform.tfstate
│   ├── preview.tfvars        # Non-sensitive preview identifiers
│   └── production.tfvars     # Non-sensitive production identifiers
└── modules/
    ├── cloudflare/           # DNS records (production only)
    ├── vercel/               # Project domain bindings
    ├── upstash/              # Redis database provisioning
    ├── supabase/             # PostgreSQL project provisioning
    └── doppler/              # Secret sync: infra outputs → Doppler configs
```

### Module Composition Flow

```
upstash module  ──┐
                  ├──→ doppler module ──→ Doppler prd/stg config
supabase module ──┘         (writes DATABASE_URL, DIRECT_URL,
                             SUPABASE_PROJECT_REF, API keys,
                             UPSTASH_REDIS_REST_URL/TOKEN)
```

Provisioning a new environment automatically populates all connection strings in Doppler — no manual copy-paste of credentials.

## Environment Isolation

Production and preview maintain **completely separate Terraform state files** in R2:

| Environment | R2 State Key                   | Doppler Config | Domain                 |
| ----------- | ------------------------------ | -------------- | ---------------------- |
| preview     | `preview/terraform.tfstate`    | `stg`          | `dev.dw-portfolio.dev` |
| production  | `production/terraform.tfstate` | `prd`          | `dw-portfolio.dev`     |

Running `tf.init` with `APP_ENV=production` reconfigures the backend to the production key. Running with `APP_ENV=preview` switches to preview. The states never share resources.

DNS records and production domains are **production-state only** — the Cloudflare module's `is_production` guard prevents any preview apply from touching DNS.

## Terraform Providers

| Provider                | Version | Purpose                         |
| ----------------------- | ------- | ------------------------------- |
| `cloudflare/cloudflare` | ~5.19.1 | DNS records, R2 state backend   |
| `vercel/vercel`         | ~5.3.0  | Project domain bindings         |
| `upstash/upstash`       | ~2.1.0  | Redis database provisioning     |
| `supabase/supabase`     | ~1.9.1  | PostgreSQL project provisioning |
| `DopplerHQ/doppler`     | ~1.21.3 | Secret sync from infra outputs  |

## Usage

```bash
# Initialize backend (run once per environment, or after deleting .terraform)
APP_ENV=production pnpm dw infra tf.init
APP_ENV=preview pnpm dw infra tf.init

# Preview changes (always run before apply)
APP_ENV=production pnpm dw infra tf.plan

# Apply all changes
APP_ENV=production pnpm dw infra tf.apply

# Apply only specific resources (safe for surgical operations)
APP_ENV=production pnpm dw infra tf.apply.target

# Import existing resources into state
APP_ENV=production pnpm dw infra tf.import

# Import a single resource by key
RESOURCE=cloudflare_apex RESOURCE_ID=<id> APP_ENV=production pnpm dw infra tf.import.single

# Remove a resource from state (without destroying it in the cloud)
APP_ENV=production pnpm dw infra tf.state-rm
```

## `tf.apply.target` — Targeted Apply

Use when you need to create or update a specific resource without touching others. Presents an interactive menu with individual resources and named presets.

**Presets:**

| Preset             | Resources                                            |
| ------------------ | ---------------------------------------------------- |
| `supabase+doppler` | Supabase project + all 5 Doppler secrets it produces |
| `upstash+doppler`  | Upstash Redis + REST URL/token Doppler secrets       |

**Typical workflow for provisioning a new Supabase project:**

```bash
APP_ENV=production pnpm dw infra tf.plan          # verify only supabase shows as + create
APP_ENV=production pnpm dw infra tf.apply.target  # select: supabase+doppler → yes
pnpm dw db migrate                                # run migrations against new DB
```

## `tf.import` — Import ID Reference

When prompted for resource IDs, use the following formats. The CLI now prints these hints inline above each prompt.

| Resource            | Where to find the ID                                   | Format (Doppler)                                        |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `upstash`           | Upstash dashboard → Redis → DB → Database ID           | `UPSTASH_DB_ID`                                         |
| `supabase`          | Supabase dashboard → Settings → General → Reference ID | `SUPABASE_PROJECT_REF` (16 chars)                       |
| `vercel_production` | Constructed from known IDs                             | `VERCEL_TEAM_ID/VERCEL_PROJECT_ID/dw-portfolio.dev`     |
| `vercel_www`        | Constructed from known IDs                             | `VERCEL_TEAM_ID/VERCEL_PROJECT_ID/www.dw-portfolio.dev` |
| `vercel_preview`    | Constructed from known IDs                             | `VERCEL_TEAM_ID/VERCEL_PROJECT_ID/dev.dw-portfolio.dev` |
| `cloudflare_*`      | Cloudflare dashboard → DNS → click record → ID in URL  | 32-char hex string                                      |
| `doppler_*`         | Auto-imported — no ID needed                           | —                                                       |

**Getting all Cloudflare record IDs at once:**

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/145e64e1bd9e74d45fd610490d6d91fe/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq '.result[] | {name: .name, type: .type, id: .id}'
```

## Required Variables

All sensitive values are injected at runtime by `scripts/terraform.sh` from Doppler. The `.tfvars` files contain only non-sensitive identifiers and are safe to commit.

| Variable                | Source                            | Sensitive |
| ----------------------- | --------------------------------- | --------- |
| `cloudflare_api_token`  | Doppler → `CLOUDFLARE_API_TOKEN`  | ✅        |
| `vercel_api_token`      | Doppler → `VERCEL_API_TOKEN`      | ✅        |
| `upstash_api_key`       | Doppler → `UPSTASH_API_KEY`       | ✅        |
| `supabase_access_token` | Doppler → `SUPABASE_ACCESS_TOKEN` | ✅        |
| `supabase_db_password`  | Doppler → `SUPABASE_DB_PASSWORD`  | ✅        |
| `doppler_token`         | Doppler → `DOPPLER_TOKEN`         | ✅        |
| `cloudflare_zone_id`    | `*.tfvars`                        | ❌        |
| `vercel_project_id`     | `*.tfvars`                        | ❌        |
| `vercel_team_id`        | `*.tfvars`                        | ❌        |
| `supabase_org_id`       | `*.tfvars`                        | ❌        |
| `upstash_email`         | `*.tfvars`                        | ❌        |

## Developer Notes

- **State backend**: Cloudflare R2 using `backend "s3" {}`. Credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`) are injected by `init.sh` at `terraform init` time — never stored in `.hcl` files.
- **`use_path_style`**: Both `backend.hcl` files use `use_path_style = true` (not the deprecated `force_path_style`).
- **DNS is production-only**: The Cloudflare module's `is_production` local guard means preview state never manages DNS records — safe to run preview plans without risk of touching global DNS.
- **Doppler writes are idempotent**: Re-running `tf.apply` for Doppler secrets is safe — it updates values in place without creating duplicates.
