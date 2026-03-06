variable "environment" {
  description = "Deployment environment: preview or production"
  type        = string
}

variable "upstash_rest_url" {
  description = "Upstash Redis REST URL"
  type        = string
}

variable "upstash_rest_token" {
  description = "Upstash Redis REST token"
  type        = string
  sensitive   = true
}

variable "supabase_db_url" {
  description = "Supabase transaction pooler DATABASE_URL"
  type        = string
  sensitive   = true
}

variable "supabase_direct_url" {
  description = "Supabase session pooler DIRECT_URL"
  type        = string
  sensitive   = true
}

variable "supabase_project_ref" {
  description = "Supabase project ref"
  type        = string
}

variable "supabase_publishable_key" {
  description = "Supabase publishable key"
  type        = string
  sensitive   = true
}

variable "supabase_secret_key" {
  description = "Supabase secret key"
  type        = string
  sensitive   = true
}
