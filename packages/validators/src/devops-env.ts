import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * DevOps / AI platform environment variables.
 *
 * Used by:
 * - packages/llm           → ANTHROPIC_API_KEY
 * - platform/ai/actions    → GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET,
 *                            SENTRY_WEBHOOK_SECRET, GITHUB_REPO
 *
 * All values are optional — the AI platform degrades gracefully when
 * absent (local dev skips agent execution).
 *
 * isDevopsConfigured()  → safe to run AI agents (LLM + GitHub)
 * isWebhookConfigured() → safe to verify incoming webhooks
 */
export function devopsEnv() {
  return createEnv({
    server: {
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
      GITHUB_TOKEN: z.string().min(1).optional(),
      GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
      SENTRY_WEBHOOK_SECRET: z.string().min(1).optional(),
      GITHUB_REPO: z
        .string()
        .regex(/^[^/]+\/[^/]+$/)
        .optional(),
      GITHUB_BRANCH: z.string().min(1).optional(),
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      APP_ENV: z
        .enum(["local", "test", "preview", "production"])
        .default("local"),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}

/**
 * Returns true when the full AI DevOps pipeline can run:
 * LLM analysis + GitHub outputs (PR comments, issues, file commits).
 */
export function isDevopsConfigured(): boolean {
  const env = devopsEnv();
  return !!(env.ANTHROPIC_API_KEY && env.GITHUB_TOKEN && env.GITHUB_REPO);
}

/**
 * Returns true when incoming webhook payloads can be verified.
 * Without this the webhook routes return 401 for all requests.
 */
export function isWebhookConfigured(type: "github" | "sentry"): boolean {
  const env = devopsEnv();
  if (type === "github") return !!env.GITHUB_WEBHOOK_SECRET;
  return !!env.SENTRY_WEBHOOK_SECRET;
}
