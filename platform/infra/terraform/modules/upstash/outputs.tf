output "rest_url" {
  description = "Upstash Redis REST URL"
  value       = "https://${upstash_redis_database.main.endpoint}"
}

output "rest_token" {
  description = "Upstash Redis REST token"
  value       = upstash_redis_database.main.rest_token
  sensitive   = true
}

output "database_id" {
  description = "Upstash database ID for imports"
  value       = upstash_redis_database.main.database_id
}
