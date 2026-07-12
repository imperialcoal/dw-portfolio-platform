output "project_id" {
  description = "Railway project ID (null in the state that doesn't manage Railway)"
  value       = local.manages_railway ? railway_project.main[0].id : null
}
