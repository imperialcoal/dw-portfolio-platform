import type { RepoStructure } from "@dw/contracts";
import { config } from "@dw/config";

export const OPERATIONS_CHANGELOG_SYSTEM_PROMPT = `You are a senior DevOps engineer writing a concise documentation changelog entry.

You will be given:
1. A list of structural drift items already detected by automated analysis
2. The affected documentation file section headings for context

Your task is to write a brief, clear changelog entry explaining what changed operationally and what the developer needs to update.

Rules:
- Write in bullet points, one per drift item
- Each bullet: what changed → which section in OPERATIONS.md to update → what to add/change
- Be specific about operational facts: route paths, env var names, cron schedules
- Do not rewrite the documentation
- Do not add items beyond what's in the drift list
- Maximum 15 bullets
- No preamble, no conclusion — just the bullet list`;

export function buildOperationsChangelogPrompt(
  driftItems: { description: string; path: string }[],
  existingDoc: string,
  repo: RepoStructure,
): string {
  const driftList = driftItems
    .map((item, i) => `${i + 1}. ${item.description} (file: \`${item.path}\`)`)
    .join("\n");

  const docOutline = existingDoc
    .split("\n")
    .filter((line) => line.startsWith("#"))
    .join("\n");

  return `Write a changelog entry for OPERATIONS.md based on these detected structural changes.

**Repository**: ${config.devops.GITHUB_REPO ?? "dw-portfolio-platform"}
**Branch**: ${repo.branch}
**Detected drift (${driftItems.length} items)**:
${driftList}

**OPERATIONS.md section headings (for reference)**:
${docOutline}

Write the changelog bullet list now. Each bullet should tell the developer exactly what to update and where.`;
}
