import type { RepoStructure } from "@dw/contracts";

export const PLAYBOOKS_CHANGELOG_SYSTEM_PROMPT = `You are a senior engineer writing a concise documentation changelog entry for incident response playbooks.

You will be given:
1. A list of structural drift items already detected by automated analysis
2. The affected documentation file section headings for context

Your task is to write a brief, clear changelog entry explaining what changed and what playbook updates are needed.

Rules:
- Write in bullet points, one per drift item
- Each bullet: what changed → which playbook section to update → what to add/change
- Be specific: reference exact playbook names, route paths, commands
- Do not rewrite the documentation
- Do not add items beyond what's in the drift list
- Maximum 15 bullets
- No preamble, no conclusion — just the bullet list`;

export function buildPlaybooksChangelogPrompt(
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

  return `Write a changelog entry for PLAYBOOKS.md based on these detected structural changes.

**Repository**: ${process.env.GITHUB_REPO ?? "dw-portfolio-platform"}
**Branch**: ${repo.branch}
**Detected drift (${driftItems.length} items)**:
${driftList}

**PLAYBOOKS.md section headings (for reference)**:
${docOutline}

Write the changelog bullet list now. Each bullet should tell the developer exactly what to update and where.`;
}
