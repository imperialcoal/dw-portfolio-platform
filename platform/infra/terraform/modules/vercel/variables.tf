variable "project_id" {
  description = "Vercel project ID"
  type        = string
}

variable "team_id" {
  description = "Vercel team ID"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Deployment environment: preview or production"
  type        = string
}
