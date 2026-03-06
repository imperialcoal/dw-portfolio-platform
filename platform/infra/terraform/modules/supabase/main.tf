resource "supabase_project" "main" {
  organization_id   = var.org_id
  name              = "dw-portfolio-${var.environment}"
  database_password = var.db_password
  region            = "us-east-1"
}

data "supabase_apikeys" "main" {
  project_ref = supabase_project.main.id
}
