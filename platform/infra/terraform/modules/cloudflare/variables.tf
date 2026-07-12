variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}
variable "tunnel_cname_target" {
  description = "CNAME target for tunnel subdomain"
  type        = string
}
variable "environment" {
  description = "Deployment environment"
  type        = string
}
variable "railway_resume_api_cname_target" {
  description = "CNAME target for the resume-api service (sourced manually from Railway dashboard)"
  type        = string
}

variable "railway_career_data_cname_target" {
  description = "CNAME target for the career-data service (sourced manually from Railway dashboard)"
  type        = string
}
