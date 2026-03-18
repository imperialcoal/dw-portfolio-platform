// Core analysis function
import type { PlatformEvent } from "@dw/contracts";

import type { ContentBlock } from "./types";
import { ANALYSIS_MODEL, getAnthropicClient } from "./client";
import {
  buildCiFailureUserPrompt,
  CI_FAILURE_SYSTEM_PROMPT,
} from "./prompts/ci-failure";
import {
  buildSentryIncidentUserPrompt,
  SENTRY_INCIDENT_SYSTEM_PROMPT,
} from "./prompts/sentry-incident";

export interface AnalysisResult {
  summary: string;
  rootCause: string;
  impact: string;
  suggestedFix: string;
  severity: "critical" | "high" | "medium" | "low";
  labels: string[];
}

// TextBlock is the text-only member of the ContentBlock union.
type TextBlock = Extract<ContentBlock, { type: "text" }>;

export async function analyzeEvent(
  event: PlatformEvent,
): Promise<AnalysisResult> {
  const client = getAnthropicClient();
  const { systemPrompt, userPrompt } = buildPrompts(event);

  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Assign to an explicitly typed variable before chaining.
  // This ensures TypeScript resolves ContentBlock[] as the array element type
  // before inferring the callback parameter types in filter/map.
  const blocks: ContentBlock[] = message.content;

  const rawText = blocks
    .filter((block: ContentBlock): block is TextBlock => block.type === "text")
    .map((block: TextBlock) => block.text)
    .join("");

  return parseAnalysisXml(rawText);
}

function buildPrompts(event: PlatformEvent): {
  systemPrompt: string;
  userPrompt: string;
} {
  switch (event.type) {
    case "ci_failure":
      return {
        systemPrompt: CI_FAILURE_SYSTEM_PROMPT,
        userPrompt: buildCiFailureUserPrompt(event),
      };
    case "sentry_error":
      return {
        systemPrompt: SENTRY_INCIDENT_SYSTEM_PROMPT,
        userPrompt: buildSentryIncidentUserPrompt(event),
      };
  }
}

function parseAnalysisXml(raw: string): AnalysisResult {
  const extract = (tag: string): string => {
    const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(raw);
    return match?.[1]?.trim() ?? "";
  };

  const severityRaw = extract("severity").toLowerCase();
  const severity = (["critical", "high", "medium", "low"] as const).includes(
    severityRaw as "critical" | "high" | "medium" | "low",
  )
    ? (severityRaw as AnalysisResult["severity"])
    : "medium";

  const labelsRaw = extract("labels");
  const labels = labelsRaw
    ? labelsRaw
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return {
    summary: extract("summary"),
    rootCause: extract("root_cause"),
    impact: extract("impact"),
    suggestedFix: extract("suggested_fix"),
    severity,
    labels,
  };
}
