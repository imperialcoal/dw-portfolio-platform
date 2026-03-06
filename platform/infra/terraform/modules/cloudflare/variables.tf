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
