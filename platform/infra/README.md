# Platform Infrastructure

Infrastructure as Code for production deployments.

## Overview

This directory is prepared for Infrastructure as Code (IaC) configurations. Currently, it contains a placeholder Terraform directory for future infrastructure definitions.

**Status**: Prepared structure - add Terraform configurations as needed.

## Structure

```
infra/
└── terraform/              # Terraform configuration (empty placeholder)
    ├── modules/            # Reusable Terraform modules
    ├── environments/       # Environment-specific configs
    │   ├── dev/
    │   ├── staging/
    │   └── production/
    └── main.tf             # Root configuration
```

## Planned Infrastructure

### Core Services

- **Vercel** - Next.js web app hosting
- **EAS** - Expo mobile app builds and OTA updates
- **Neon/Supabase** - Managed PostgreSQL database
- **Upstash** - Managed Redis for caching and rate limiting
- **Clerk** - Authentication service (managed)

### Optional Services

- **Sentry** - Error tracking and monitoring
- **Axiom/Datadog** - Logging and observability
- **CloudFlare** - DNS and CDN
- **GitHub Actions** - CI/CD (already configured)

## Terraform Setup

When ready to provision infrastructure:

### 1. Initialize Terraform

```bash
cd platform/infra/terraform
terraform init
```

### 2. Create Configuration

```hcl
# main.tf
terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.0"
    }
  }

  backend "s3" {
    bucket = "dw-terraform-state"
    key    = "platform/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
}

provider "upstash" {
  api_key = var.upstash_api_key
  email   = var.upstash_email
}
```

### 3. Define Resources

```hcl
# vercel.tf
resource "vercel_project" "nextjs" {
  name      = "dw-portfolio-nextjs"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = "your-org/dw-portfolio-platform"
  }

  environment = [
    {
      key    = "DATABASE_URL"
      value  = var.database_url
      target = ["production"]
    },
    # ... more environment variables
  ]
}

# upstash.tf
resource "upstash_redis_database" "main" {
  database_name = "dw-portfolio-prod"
  region        = "us-east-1"
  tls           = true
  eviction      = true
}
```

### 4. Apply Infrastructure

```bash
# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy infrastructure (careful!)
terraform destroy
```

## Manual Provisioning (Current Approach)

Until Terraform is configured, manually provision:

### Next.js (Vercel)

1. Connect GitHub repository
2. Set root directory: `apps/nextjs`
3. Add environment variables
4. Deploy

### Database (Neon/Supabase)

1. Create PostgreSQL database
2. Copy connection strings
3. Update `DATABASE_URL` and `DIRECT_URL`
4. Run migrations: `pnpm db:push`

### Redis (Upstash)

1. Create Redis database
2. Copy REST URL and token
3. Update `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### Authentication (Clerk)

1. Create Clerk application
2. Configure OAuth providers
3. Copy API keys
4. Set up webhook for user sync

## Environment Variables

### Production

Store sensitive values in:
- **Vercel**: Environment variables section
- **GitHub**: Repository secrets (for CI)
- **Local**: Never commit `.env.local`

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# App
AUTH_REDIRECT_PROXY_URL=https://your-domain.com/api/auth
PROJECT_NAME=dw-portfolio-platform
```

## Monitoring & Observability

### Recommended Tools

- **Sentry**: Error tracking for Next.js and Expo
- **Vercel Analytics**: Web vitals and performance
- **Upstash QStash**: Background jobs and cron (future)
- **Better Uptime**: Status page and monitoring

### Setting Up Sentry

```bash
# Install Sentry
pnpm add @sentry/nextjs @sentry/react-native

# Initialize
npx @sentry/wizard@latest -i nextjs
```

## Infrastructure Checklist

Before going to production:

- [ ] Provision production database with backups
- [ ] Set up Redis with persistence
- [ ] Configure Clerk for production
- [ ] Set up error tracking (Sentry)
- [ ] Configure monitoring and alerts
- [ ] Set up status page
- [ ] Document runbooks for common operations
- [ ] Test disaster recovery procedures
- [ ] Enable database backups
- [ ] Configure CDN (if needed)

## Cost Estimation

### Free Tier (Development)

- Vercel: Free for personal projects
- Neon: Free tier with 3 GB storage
- Upstash: Free tier with 10k requests/day
- Clerk: Free tier with 10k MAU
- GitHub Actions: 2,000 minutes/month free

### Production (Estimated)

- Vercel Pro: $20/month
- Neon: ~$20-50/month (depends on usage)
- Upstash: ~$10-30/month (depends on usage)
- Clerk: ~$25-100/month (depends on users)
- Sentry: ~$26/month
- **Total**: ~$100-250/month

## Security Best Practices

1. **Use managed services** where possible
2. **Enable encryption** at rest and in transit
3. **Rotate credentials** regularly
4. **Use least-privilege access** for service accounts
5. **Enable audit logging**
6. **Set up alerts** for suspicious activity
7. **Regular security audits**
8. **Keep dependencies updated**

## Disaster Recovery

### Database Backups

- Daily automated backups (Neon/Supabase)
- Point-in-time recovery
- Test restore procedures monthly

### Rollback Strategy

1. **Database**: Point-in-time restore
2. **Application**: Git revert + redeploy
3. **Infrastructure**: Terraform state rollback

## Future Enhancements

- [ ] Terraform modules for full infrastructure
- [ ] Multi-region deployment
- [ ] Blue-green deployments
- [ ] Automated failover
- [ ] Infrastructure testing
- [ ] Cost optimization automation

## Related Documentation

- [Platform Overview](../README.md) - Platform architecture
- [Dev Tools](../dev-tools/README.md) - Local infrastructure
- [Pipelines](../pipelines/README.md) - CI/CD
