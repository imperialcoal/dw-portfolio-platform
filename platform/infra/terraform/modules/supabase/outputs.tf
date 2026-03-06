output "project_id" {
  description = "Supabase project ID"
  value       = supabase_project.main.id
}

output "project_ref" {
  description = "Supabase project ref (used in connection strings)"
  value       = supabase_project.main.id
}

output "database_url" {
  description = "Supabase transaction pooler URL for runtime queries"
  value       = "postgresql://postgres.${supabase_project.main.id}:${var.db_password}@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
  sensitive   = true
}

output "direct_url" {
  description = "Supabase session pooler URL for migrations"
  value       = "postgresql://postgres.${supabase_project.main.id}:${var.db_password}@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
  sensitive   = true
}

output "publishable_key" {
  description = "Supabase publishable key"
  value       = data.supabase_apikeys.main.publishable_key
  sensitive   = true
}

output "secret_key" {
  description = "Supabase secret key"
  value       = data.supabase_apikeys.main.secret_keys[0].api_key
  sensitive   = true
}
