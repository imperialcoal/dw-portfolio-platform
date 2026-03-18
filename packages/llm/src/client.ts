import Anthropic from "@anthropic-ai/sdk";

import { config } from "@dw/config";

let _client: Anthropic | null = null;

/**
 * Returns the Anthropic client singleton.
 * Throws if ANTHROPIC_API_KEY is not configured — callers should check
 * isDevopsConfigured() before calling analyzeEvent() in production code.
 */
export function getAnthropicClient(): Anthropic {
  if (_client) return _client;

  const apiKey = config.devops.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to Doppler to enable AI analysis.",
    );
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

// All agents use Sonnet — right balance of quality and cost for DevOps analysis.
export const ANALYSIS_MODEL = "claude-sonnet-4-20250514" as const;
