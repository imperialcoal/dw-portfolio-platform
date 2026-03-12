import { apiEnv } from "@dw/validators/api-env";
import { authEnv } from "@dw/validators/auth-env";
import { clerkEnv } from "@dw/validators/clerk-env";
import { dbEnv } from "@dw/validators/db-env";
import { devopsEnv } from "@dw/validators/devops-env";
import { messagingEnv } from "@dw/validators/messaging-env";
import { observabilityEnv } from "@dw/validators/observability-env";
import { supabaseEnv } from "@dw/validators/supabase-env";

/**
 * Single runtime config composed from validated envs
 */
export const config = Object.freeze({
  app: apiEnv(),
  auth: authEnv(),
  clerk: clerkEnv(),
  db: dbEnv(),
  devops: devopsEnv(),
  messaging: messagingEnv(),
  observability: observabilityEnv(),
  supabase: supabaseEnv(),
});

export type Config = typeof config;
