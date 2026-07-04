# Railway project for the Go microservices (resume-api, career-data).
#
# Only the preview Terraform state manages this — see local.manages_railway
# below. Production Railway services don't exist yet (tracked as a pending
# item from the original handoff).
#
# default_environment = { name = "production" } — this is Railway's real,
# immutable value for this project (confirmed via terraform state show and
# the "forces replacement" warning Terraform itself gave when we tried
# declaring "staging" here). This field can only be set at project
# creation and cannot be changed afterward by any means we found. Our
# actual services live in a separate "staging" environment within this
# same project — that mismatch is exactly why railway_service and
# railway_custom_domain had to be dropped below; it has no bearing on the
# railway_project resource itself, which only needs to reflect the truth.
#
# railway_service and railway_custom_domain resources were deliberately
# removed after confirming both structurally require Railway's
# project-level `default_environment` to resolve a ServiceInstance — and
# that field is fixed to the project's original "production" environment,
# with no dashboard setting or public GraphQL mutation to reassign it to
# "staging" (checked both; neither exists). Our real services live in
# "staging", not "production", so any railway_service or
# railway_custom_domain resource declared against this project would
# always fail reading its own settings ("ServiceInstance not found"),
# regardless of the ID supplied at import.
#
# This is a genuine limitation of terraform-community-providers/railway
# (see open issue #23, "Environment switching"), not a config error on our
# part. resume-api and career-data remain dashboard-managed for now — see
# handoff for details. If this provider (or Railway's own native IaC tool)
# adds environment-targeting support later, revisit.

locals {
  manages_railway = var.environment == "preview"
}

resource "railway_project" "main" {
  count          = local.manages_railway ? 1 : 0
  name           = "dw-portfolio-platform"
  private        = true
  has_pr_deploys = false

  default_environment = {
    name = "production"
  }
}
