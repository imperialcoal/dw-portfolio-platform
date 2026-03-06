# Redis databases

resource "upstash_redis_database" "main" {
  database_name  = "dw-portfolio-${var.environment}"
  region         = "global"
  primary_region = "us-east-2"
  tls            = true
}
