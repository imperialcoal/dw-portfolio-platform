import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod/v4";

import { authEnv } from "@dw/validators/auth-env";
import { clerkEnv } from "@dw/validators/clerk-env";
import { cronEnv } from "@dw/validators/cron-env";
import { devopsEnv } from "@dw/validators/devops-env";
import {
  appEnvSchema,
  databaseSchema,
  nodeEnvSchema,
  redisSchema,
  supabasePublicSchema,
} from "@dw/validators/env-schemas";
import { messagingEnv } from "@dw/validators/messaging-env";
import { observabilityEnv } from "@dw/validators/observability-env";
import { qstashEnv } from "@dw/validators/qstash-env";
import { redisEnv } from "@dw/validators/redis-env";
import { resumeEnv } from "@dw/validators/resume-env";
import { supabaseEnv } from "@dw/validators/supabase-env";

export const env = createEnv({
  extends: [
    authEnv(),
    clerkEnv(),
    cronEnv(),
    devopsEnv(),
    messagingEnv(),
    observabilityEnv(),
    qstashEnv(),
    redisEnv(),
    resumeEnv(),
    supabaseEnv(),
    vercel(),
  ],
  shared: {
    ...nodeEnvSchema,
    ...appEnvSchema,
  },
  /**
   * Server-side environment variables.
   * Cloud service keys validated in their respective env functions above.
   *
   * DEMO_MODE, RECRUITER_EMAILS, and DEMO_USER_CLERK_ID are intentionally
   * NOT redeclared here — they are defined once in authEnv() (auth-env.ts)
   * and typed on the composed `env` object automatically via `extends`.
   * Redeclaring them here would just be duplication; t3-env merges every
   * extended schema's keys into the final type without needing a local copy.
   */
  server: {
    ...databaseSchema,
    ...redisSchema,
  },
  /**
   * Client-side environment variables (NEXT_PUBLIC_ prefix required).
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    ...supabasePublicSchema,
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    NEXT_PUBLIC_GITHUB_REPO: process.env.NEXT_PUBLIC_GITHUB_REPO,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
