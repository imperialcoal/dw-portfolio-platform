# @dw/llm

Anthropic SDK wrapper and AI analysis engine for the platform. Provides the `analyzeEvent()` function that sends a `PlatformEvent` to Claude Sonnet, receives a structured XML response, and parses it into a typed `AnalysisResult`. Also exports per-event-type system and user prompt builders.

## Purpose

Decouples the LLM integration from the agent orchestration layer (`platform/ai`). AI agents in `@dw/ai` call `analyzeEvent()` without needing to know about the Anthropic SDK, prompt construction, or response parsing.

## Architecture

```
src/
├── client.ts           # Anthropic singleton — getAnthropicClient(), ANALYSIS_MODEL
├── analyze.ts          # analyzeEvent() + parseAnalysisXml()
├── types.ts            # ContentBlock type (re-exported from Anthropic SDK)
└── prompts/
    ├── ci-failure.ts   # System prompt + buildCiFailureUserPrompt()
    ├── security-alert.ts # System prompt + buildSecurityAlertUserPrompt()
    └── sentry-incident.ts # System prompt + buildSentryIncidentUserPrompt()
```

## Key Exports

```typescript
// Core function
export async function analyzeEvent(
  event: PlatformEvent,
): Promise<AnalysisResult>;

// Analysis output shape
export interface AnalysisResult {
  summary: string;
  rootCause: string;
  impact: string;
  suggestedFix: string;
  severity: "critical" | "high" | "medium" | "low";
  labels: string[];
}

// Client (for direct use if needed)
export function getAnthropicClient(): Anthropic;
export const ANALYSIS_MODEL: "claude-sonnet-4-20250514";
```

### Response Format

All prompts instruct Claude to respond in XML:

```xml
<summary>One-line incident summary</summary>
<root_cause>Technical explanation</root_cause>
<impact>User/system impact</impact>
<suggested_fix>Actionable resolution steps</suggested_fix>
<severity>critical|high|medium|low</severity>
<labels>label1, label2, label3</labels>
```

`parseAnalysisXml()` extracts each field via regex, defaulting to `"medium"` severity if the extracted value is not a valid enum member.

## Configuration

Requires `ANTHROPIC_API_KEY` in `config.devops`. Call `isDevopsConfigured()` from `@dw/validators/devops-env` before calling `analyzeEvent()` in code paths where the key may be absent (e.g., local dev without Doppler).

The model is pinned to `claude-sonnet-4-20250514` — the right balance of quality and cost for DevOps analysis. To change the model, update `ANALYSIS_MODEL` in `src/client.ts`.

## Dependencies

Consumes: `@dw/config`, `@dw/contracts`

Consumed by: `@dw/ai`

## Developer Notes

> **Developer Note**
> The intermediate `const blocks: ContentBlock[]` variable in `analyze.ts` (lines 47-52) is required because TypeScript cannot infer the callback parameter type in `.filter()` when chaining directly on `message.content`. The Anthropic SDK's `ContentBlock` is a union type, and TypeScript needs an explicit type annotation on the array before narrowing works correctly in a filter predicate. Removing the intermediate variable causes a type error even though the runtime behavior is identical.
