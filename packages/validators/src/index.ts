// ─────────────────────────────────────────────
// Environment validators
// ─────────────────────────────────────────────

// Core runtime env
export { apiEnv } from "./api-env";
export { dbEnv } from "./db-env";

// Auth & identity
export { authEnv } from "./auth-env";
export { clerkEnv, isClerkConfigured } from "./clerk-env";

// Cloud services
export { supabaseEnv, isSupabaseConfigured } from "./supabase-env";
export {
  messagingEnv,
  isMessagingConfigured,
  isAgentEmailConfigured,
} from "./messaging-env";
export { qstashEnv, isQStashConfigured } from "./qstash-env";
export { redisEnv, isRedisConfigured } from "./redis-env";

// Platform AI & DevOps
export {
  devopsEnv,
  isDevopsConfigured,
  isWebhookConfigured,
} from "./devops-env";
export {
  observabilityEnv,
  isSentryApiConfigured,
  isVercelApiConfigured,
} from "./observability-env";

// ─────────────────────────────────────────────
// Shared schema fragments (for createEnv spreads)
// ─────────────────────────────────────────────

export {
  nodeEnvSchema,
  appEnvSchema,
  redisSchema,
  databaseSchema,
  supabasePublicSchema,
} from "./env-schemas";
