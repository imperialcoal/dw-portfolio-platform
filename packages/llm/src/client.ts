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
//
// claude-sonnet-4-20250514 reached end-of-life on 2026-06-15 and now
// returns a hard 404 (not_found_error) on every request. Discovered via
// the demo CI/Sentry trigger panel silently failing on first attempt and
// getting swallowed by QStash's retry-then-dedup-skip behavior on the
// second — the same 404 would have been silently dropping every REAL
// GitHub/Sentry-triggered incident since the EOL date too, since all
// three agents (ci-agent.ts, sentry-agent.ts, security-agent.ts) import
// this single constant.
//
// Set to "claude-sonnet-5" — worth confirming against Anthropic's current
// model list (docs.claude.com) whether a specific dated snapshot exists
// for this generation, the way "-20250514" pinned the previous one; if so,
// prefer that over this generational alias so a future deprecation shows
// up as a deliberate version bump you control, rather than a silent
// rolling alias change or another surprise EOL.
export const ANALYSIS_MODEL = "claude-sonnet-5" as const;
