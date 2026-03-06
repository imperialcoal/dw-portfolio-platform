# Import existing project — Terraform manages domains only
# Environment variables are managed by Doppler sync
data "vercel_project" "portfolio" {
  name    = "dw-portfolio-platform"
  team_id = var.team_id != "" ? var.team_id : null
}

# Production domain
resource "vercel_project_domain" "production" {
  count      = var.environment == "production" ? 1 : 0
  project_id = data.vercel_project.portfolio.id
  team_id    = var.team_id != "" ? var.team_id : null
  domain     = "dw-portfolio.dev"
}

resource "vercel_project_domain" "www" {
  count      = var.environment == "production" ? 1 : 0
  project_id = data.vercel_project.portfolio.id
  team_id    = var.team_id != "" ? var.team_id : null
  domain     = "www.dw-portfolio.dev"
}

# Preview domain
resource "vercel_project_domain" "preview" {
  count       = var.environment == "preview" ? 1 : 0
  project_id  = data.vercel_project.portfolio.id
  team_id     = var.team_id != "" ? var.team_id : null
  domain      = "dev.dw-portfolio.dev"
  git_branch  = "dev"
}
