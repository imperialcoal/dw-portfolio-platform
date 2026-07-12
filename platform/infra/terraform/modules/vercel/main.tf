# Import existing project — Terraform manages domains only
# Environment variables are managed by Doppler sync
data "vercel_project" "portfolio" {
  name    = var.project_name
  team_id = var.team_id != "" ? var.team_id : null
}

# Production domain
resource "vercel_project_domain" "production" {
  count      = var.environment == "production" ? 1 : 0
  project_id = data.vercel_project.portfolio.id
  team_id    = var.team_id != "" ? var.team_id : null
  domain     = var.production_domain
}

resource "vercel_project_domain" "www" {
  count      = var.environment == "production" && var.www_domain != "" ? 1 : 0
  project_id = data.vercel_project.portfolio.id
  team_id    = var.team_id != "" ? var.team_id : null
  domain     = var.www_domain
}

# Preview domain
resource "vercel_project_domain" "preview" {
  count      = var.environment == "preview" ? 1 : 0
  project_id = data.vercel_project.portfolio.id
  team_id    = var.team_id != "" ? var.team_id : null
  domain     = var.preview_domain
  git_branch = var.git_branch
}
