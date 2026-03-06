output "project_id" {
  description = "Vercel project ID"
  value       = data.vercel_project.portfolio.id
}

output "deployment_url" {
  description = "Primary deployment URL for this environment"
  value = (
    var.environment == "production"
    ? "https://dw-portfolio.dev"
    : "https://dev.dw-portfolio.dev"
  )
}
