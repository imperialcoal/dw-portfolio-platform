variable "project_id" {
  description = "Vercel project ID"
  type        = string
}

variable "project_name" {
  description = "Vercel project name to look up"
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

variable "production_domain" {
  description = "Domain to attach in production"
  type        = string
}

variable "preview_domain" {
  description = "Domain to attach in preview"
  type        = string
}

variable "www_domain" {
  description = "Optional www redirect domain — production only, omit to skip"
  type        = string
  default     = ""
}

variable "git_branch" {
  description = "Git branch the preview domain tracks"
  type        = string
  default     = "dev"
}
