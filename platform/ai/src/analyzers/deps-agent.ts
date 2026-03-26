// Dependency breaking change agent.
// Called for major version Dependabot PRs only — minor/patch are never analyzed.
// Posts analysis as a PR comment and caches the result in Redis via memory layer.

import type { BreakingChangeAnalysis, DependabotPR } from "@dw/contracts";
import type { ContentBlock } from "@dw/llm";
import { config } from "@dw/config";
import {
  ANALYSIS_MODEL,
  buildDepsAnalysisPrompt,
  DEPS_ANALYSIS_SYSTEM_PROMPT,
  getAnthropicClient,
} from "@dw/llm";

import { getDepAnalysis, storeDepAnalysis } from "../memory/redis";

// ─────────────────────────────────────────────
// PR body / changelog fetcher
// ─────────────────────────────────────────────

async function fetchPRBody(prNumber: number): Promise<string> {
  const token = config.devops.GITHUB_TOKEN;
  const repo = config.devops.GITHUB_REPO;
  if (!token || !repo) return "";

  const res = await fetch(
    `https://api.github.com/repos/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!res.ok) return "";
  const data = (await res.json()) as { body?: string };
  return data.body ?? "";
}

// ─────────────────────────────────────────────
// XML parser
// ─────────────────────────────────────────────

function parseAnalysisXml(
  raw: string,
  pr: DependabotPR,
): BreakingChangeAnalysis {
  const extract = (tag: string): string => {
    const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(raw);
    return match?.[1]?.trim() ?? "";
  };
  const extractAll = (tag: string): string[] => {
    const matches = [
      ...raw.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g")),
    ];
    return matches.map((m) => m[1]?.trim() ?? "").filter(Boolean);
  };

  const recommendationRaw = extract("recommendation");
  const recommendation =
    recommendationRaw === "merge-safely" ||
    recommendationRaw === "review-required" ||
    recommendationRaw === "block-merge"
      ? recommendationRaw
      : "review-required";

  return {
    prNumber: pr.number,
    packageName: pr.packageName,
    fromVersion: pr.fromVersion ?? "",
    toVersion: pr.toVersion ?? "",
    isBreaking: extract("is_breaking") === "true",
    summary: extract("summary"),
    breakingChanges: extractAll("change"),
    affectedAreas: extractAll("area"),
    migrationSteps: extractAll("step"),
    recommendation,
    analyzedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// PR comment formatter
// ─────────────────────────────────────────────

function formatAnalysisComment(analysis: BreakingChangeAnalysis): string {
  const badge = analysis.isBreaking ? "🔴 Breaking Change" : "🟢 Non-Breaking";
  const rec = {
    "merge-safely": "✅ Safe to merge",
    "review-required": "⚠️ Review required before merging",
    "block-merge": "🚫 Do not merge without careful migration",
  }[analysis.recommendation];

  const breakingSection =
    analysis.breakingChanges.length > 0
      ? `\n### Breaking Changes\n${analysis.breakingChanges.map((c) => `- ${c}`).join("\n")}`
      : "";

  const affectedSection =
    analysis.affectedAreas.length > 0
      ? `\n### Affected Areas\n${analysis.affectedAreas.map((a) => `- ${a}`).join("\n")}`
      : "";

  const migrationSection =
    analysis.migrationSteps.length > 0
      ? `\n### Migration Steps\n${analysis.migrationSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";

  return `## ${badge} — \`${analysis.packageName}\` ${analysis.fromVersion} → ${analysis.toVersion}

> ${analysis.summary}

**Recommendation**: ${rec}
${breakingSection}${affectedSection}${migrationSection}

---
<sub>🤖 Breaking change analysis by platform-agent · Powered by Claude</sub>`;
}

// ─────────────────────────────────────────────
// Main agent function
// ─────────────────────────────────────────────

/**
 * Analyzes a major version Dependabot PR for breaking changes.
 * Posts a comment on the PR and caches the result in Redis via the memory layer.
 *
 * Only call for major version updates (pr.isMajor === true).
 * Returns the cached result if analysis already exists.
 */
export async function runDepsAgent(
  pr: DependabotPR,
): Promise<BreakingChangeAnalysis | null> {
  // Return cached analysis if it exists
  const cached = await getDepAnalysis(pr.number);
  if (cached) {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "deps",
        event: "cache_hit",
        prNumber: pr.number,
        packageName: pr.packageName,
      }),
    );
    return cached;
  }

  console.log(
    JSON.stringify({
      level: "info",
      agent: "deps",
      event: "started",
      prNumber: pr.number,
      packageName: pr.packageName,
      fromVersion: pr.fromVersion,
      toVersion: pr.toVersion,
    }),
  );

  const prBody = await fetchPRBody(pr.number);
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 1024,
    system: DEPS_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildDepsAnalysisPrompt(pr, prBody) }],
  });

  // Use the same ContentBlock pattern as analyze.ts — extract text via type guard
  const blocks: ContentBlock[] = message.content;
  const rawText = blocks
    .filter(
      (block): block is Extract<ContentBlock, { type: "text" }> =>
        block.type === "text",
    )
    .map((block) => block.text)
    .join("");

  const analysis = parseAnalysisXml(rawText, pr);

  // Post comment on the PR
  const comment = formatAnalysisComment(analysis);
  const token = config.devops.GITHUB_TOKEN;
  const repo = config.devops.GITHUB_REPO;

  if (token && repo) {
    await fetch(
      `https://api.github.com/repos/${repo}/issues/${pr.number}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ body: comment }),
      },
    ).catch((e: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          agent: "deps",
          step: "pr_comment",
          prNumber: pr.number,
          error: String(e),
        }),
      );
    });
  }

  // Cache via memory layer
  await storeDepAnalysis(analysis);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "deps",
      event: "complete",
      prNumber: pr.number,
      isBreaking: analysis.isBreaking,
      recommendation: analysis.recommendation,
    }),
  );

  return analysis;
}
