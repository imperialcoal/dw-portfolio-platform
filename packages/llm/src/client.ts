// Anthropic SDK singleton
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// All agents use Sonnet — right balance of quality and cost for DevOps analysis.
export const ANALYSIS_MODEL = "claude-sonnet-4-20250514" as const;
