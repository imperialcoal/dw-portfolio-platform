# DNS records, tunnel

# DNS records are global (domain-level) infrastructure.
# They are managed by the production state only.
# Preview state does not touch DNS records.

locals {
  is_production = var.environment == "production"
}

resource "cloudflare_dns_record" "apex" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "@"
  type    = "A"
  content = "216.198.79.1"
  ttl     = 1
  proxied = false
}

# www CNAME — production only
resource "cloudflare_dns_record" "www" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "www"
  type    = "CNAME"
  content = "e148a6952895ca7c.vercel-dns-017.com"
  ttl     = 1
  proxied = false
}

# Preview domain — production apply manages this
# so it exists regardless of which env is being applied
resource "cloudflare_dns_record" "preview" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "dev"
  type    = "CNAME"
  content = "e148a6952895ca7c.vercel-dns-017.com"
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "portfolio" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "portfolio"
  type    = "CNAME"
  content = "e148a6952895ca7c.vercel-dns-017.com"
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "dev_portfolio" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "dev.portfolio"
  type    = "CNAME"
  content = "e148a6952895ca7c.vercel-dns-017.com"
  ttl     = 1
  proxied = false
}

# Railway resume-api service — production apply manages this
resource "cloudflare_dns_record" "resume_api" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "dev.resume-api"
  type    = "CNAME"
  content = var.railway_resume_api_cname_target
  ttl     = 1
  proxied = false
}

# Railway career-data service — production apply manages this
resource "cloudflare_dns_record" "career_data" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "dev.career-data"
  type    = "CNAME"
  content = var.railway_career_data_cname_target
  ttl     = 1
  proxied = false
}

# Tunnel subdomain — production apply manages this
resource "cloudflare_dns_record" "tunnel" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "tunnel"
  type    = "CNAME"
  content = var.tunnel_cname_target
  ttl     = 1
  proxied = true
}

# SPF — production only (domain-level record)
resource "cloudflare_dns_record" "spf" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "send"
  type    = "TXT"
  content = "v=spf1 include:amazonses.com ~all"
  ttl     = 1
  proxied = false
}

# DMARC — production only
resource "cloudflare_dns_record" "dmarc" {
  count   = local.is_production ? 1 : 0
  zone_id = var.zone_id
  name    = "_dmarc"
  type    = "TXT"
  content = "v=DMARC1; p=none; rua=mailto:dw.portfolio.78@gmail.com"
  ttl     = 1
  proxied = false
}
