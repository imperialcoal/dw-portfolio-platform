# Output values

output "environment" {
  description = "Active environment for this state"
  value       = var.environment
}

output "upstash_rest_url" {
  description = "Upstash Redis REST URL"
  value       = module.upstash.rest_url
}

output "upstash_rest_token" {
  description = "Upstash Redis REST token"
  value       = module.upstash.rest_token
  sensitive   = true
}

output "supabase_project_id" {
  description = "Supabase project ID"
  value       = module.supabase.project_id
}

output "supabase_project_ref" {
  description = "Supabase project ref"
  value       = module.supabase.project_ref
}

output "supabase_database_url" {
  description = "Supabase database URL"
  value       = module.supabase.database_url
  sensitive   = true
}

output "vercel_platform_deployment_url" {
  description = "Primary platform deployment URL"
  value       = module.vercel_platform.deployment_url
}

output "vercel_home_deployment_url" {
  description = "Astro portfolio deployment URL"
  value       = module.vercel_home.deployment_url
}

output "railway_project_id" {
  description = "Railway project ID"
  value       = module.railway.project_id
}
