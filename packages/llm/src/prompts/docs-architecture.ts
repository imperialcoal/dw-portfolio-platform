import type { RepoStructure } from "@dw/contracts";

// This prompt is only invoked when structural drift has already been detected
// by the pure-function detectors in docs-agent.ts. Claude's job here is
// narrow: translate the structured drift findings into a clear, human-readable
// changelog entry. It does not scan the repo independently.
export const ARCHITECTURE_CHANGELOG_SYSTEM_PROMPT = `You are a senior staff engineer writing a concise documentation changelog entry.

You will be given:
1. A list of structural drift items already detected by automated analysis
2. The affected documentation file for context

Your task is to write a brief, clear changelog entry explaining what changed and what the developer needs to update. 

Rules:
- Write in bullet points, one per drift item
- Each bullet: what changed → which section to update → what to add/change
- Be specific: reference exact section names, route paths, package names
- Do not rewrite the documentation
- Do not add items beyond what's in the drift list
- Maximum 15 bullets
- No preamble, no conclusion — just the bullet list`;

export function buildArchitectureChangelogPrompt(
  driftItems: { description: string; path: string }[],
  existingDoc: string,
  repo: RepoStructure,
): string {
  const driftList = driftItems
    .map((item, i) => `${i + 1}. ${item.description} (file: \`${item.path}\`)`)
    .join("\n");

  // Only send the section headings from the existing doc, not full content
  // This keeps the prompt lean while giving Claude the structure it needs
  const docOutline = existingDoc
    .split("\n")
    .filter((line) => line.startsWith("#"))
    .join("\n");

  return `Write a changelog entry for ARCHITECTURE.md based on these detected structural changes.

**Repository**: ${process.env.GITHUB_REPO ?? "dw-portfolio-platform"}
**Branch**: ${repo.branch}
**Detected drift (${driftItems.length} items)**:
${driftList}

**ARCHITECTURE.md section headings (for reference)**:
${docOutline}

Write the changelog bullet list now. Each bullet should tell the developer exactly what to update and where.`;
}
