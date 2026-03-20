import { apiEnv } from "@dw/validators/api-env";
import { authEnv } from "@dw/validators/auth-env";
import { clerkEnv } from "@dw/validators/clerk-env";
import { cronEnv } from "@dw/validators/cron-env";
import { dbEnv } from "@dw/validators/db-env";
import { devopsEnv } from "@dw/validators/devops-env";
import { messagingEnv } from "@dw/validators/messaging-env";
import { observabilityEnv } from "@dw/validators/observability-env";
import { qstashEnv } from "@dw/validators/qstash-env";
import { redisEnv } from "@dw/validators/redis-env";
import { supabaseEnv } from "@dw/validators/supabase-env";

/**
 * Single runtime config composed from validated envs
 */
export const config = Object.freeze({
  app: apiEnv(),
  auth: authEnv(),
  clerk: clerkEnv(),
  cron: cronEnv(),
  db: dbEnv(),
  devops: devopsEnv(),
  messaging: messagingEnv(),
  observability: observabilityEnv(),
  qstash: qstashEnv(),
  redis: redisEnv(),
  supabase: supabaseEnv(),
});

export type Config = typeof config;
