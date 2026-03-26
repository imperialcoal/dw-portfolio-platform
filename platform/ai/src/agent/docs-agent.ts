// Documentation drift agent — structural diff + targeted Claude changelog.
// Triggered nightly via Vercel cron → GET /api/cron/docs-agent,
// or manually via POST /api/platform/docs/trigger from the platform dashboard.
//
// Flow:
//   1. Scan repo via GitHub API (tree + key files)
//   2. Run structural detectors (pure functions, no I/O, no LLM)
//   3. If zero drift → exit cleanly, no commits
//   4. If drift found:
//      a. One focused Claude call per affected doc to write changelog bullets
//      b. appendToFile: fetch full doc → strip previous block → append new block → commit
//      c. Commit a standalone drift report to docs/drift-reports/
//
// Cost profile:
//   - Clean night: GitHub API calls only (~15s, no LLM)
//   - Drift night: GitHub API + 1-3 small Claude calls (~30s, ~1-3K tokens each)
//
// Principles:
//   - Never overwrites existing documentation — appendToFile guarantees this
//   - Claude's scope is strictly "explain what the detectors found"
//   - Docs without existing content are skipped (first version must be human-written)
//   - Drift report committed regardless, giving a searchable history
//   - appendToFile uses the Git Blobs API fallback for docs > 1MB, eliminating
//     the truncation bug that previously wrote only the changelog block

import type { DocsAgentResult, RepoStructure } from "@dw/contracts";
import type { ContentBlock } from "@dw/llm";
import {
  ANALYSIS_MODEL,
  ARCHITECTURE_CHANGELOG_SYSTEM_PROMPT,
  buildArchitectureChangelogPrompt,
  buildOperationsChangelogPrompt,
  buildPlaybooksChangelogPrompt,
  getAnthropicClient,
  OPERATIONS_CHANGELOG_SYSTEM_PROMPT,
  PLAYBOOKS_CHANGELOG_SYSTEM_PROMPT,
} from "@dw/llm";

import { appendToFile, commitFile } from "../actions/github";
import { scanRepo } from "../sensors/repo";

// ─────────────────────────────────────────────
// Structural diff types
// ─────────────────────────────────────────────

interface DriftItem {
  category:
    | "new_api_route"
    | "new_package"
    | "new_env_var"
    | "new_cron"
    | "new_webhook_handler"
    | "missing_readme"
    | "empty_readme";
  path: string;
  description: string;
  affectedDocs: string[];
}

// ─────────────────────────────────────────────
// Structural detectors — pure functions, no I/O
// ─────────────────────────────────────────────

const ROUTE_EXCLUSIONS = [
  "/api/sentry-example-api", // Sentry SDK test route — not a real endpoint
];

function detectNewApiRoutes(
  repo: RepoStructure,
  archDoc: string,
  opsDoc: string,
): DriftItem[] {
  return repo.allPaths
    .filter((p) => p.includes("/api/") && p.endsWith("route.ts"))
    .filter((p) => {
      const match = /app(\/api\/[^/]+(?:\/[^/]+)*)\/route\.ts$/.exec(p);
      if (!match?.[1]) return false;
      const route = match[1];
      return (
        !ROUTE_EXCLUSIONS.includes(route) &&
        !archDoc.includes(route) &&
        !opsDoc.includes(route)
      );
    })
    .map((p) => {
      const match = /app(\/api\/[^/]+(?:\/[^/]+)*)\/route\.ts$/.exec(p);
      const route = match?.[1] ?? p;
      return {
        category: "new_api_route" as const,
        path: p,
        description: `Route \`${route}\` is not mentioned in documentation`,
        affectedDocs: ["docs/ARCHITECTURE.md", "docs/OPERATIONS.md"],
      };
    });
}

const PACKAGE_EXCLUSION_PREFIXES = [
  "platform/standards/", // documented as platform/standards/ collectively
];

function detectNewPackages(repo: RepoStructure, archDoc: string): DriftItem[] {
  return repo.allPaths
    .filter(
      (p) =>
        p.endsWith("/package.json") &&
        (p.startsWith("packages/") ||
          p.startsWith("apps/") ||
          p.startsWith("platform/")) &&
        !PACKAGE_EXCLUSION_PREFIXES.some((prefix) => p.startsWith(prefix)),
    )
    .filter((p) => {
      const dir = p.replace("/package.json", "");
      const name = dir.split("/").pop() ?? "";
      return !archDoc.includes(name) && name.length > 0;
    })
    .map((p) => {
      const dir = p.replace("/package.json", "");
      const name = dir.split("/").pop() ?? dir;
      return {
        category: "new_package" as const,
        path: p,
        description: `Package \`${dir}\` (${name}) is not mentioned in ARCHITECTURE.md`,
        affectedDocs: ["docs/ARCHITECTURE.md"],
      };
    });
}

function detectNewIncidentTypes(
  repo: RepoStructure,
  playbooksDoc: string,
): DriftItem[] {
  const analyzerPaths = repo.allPaths.filter(
    (p) =>
      p.includes("platform/ai/src/analyzers/") &&
      p.endsWith("-agent.ts") &&
      !p.endsWith("index.ts"),
  );

  return analyzerPaths
    .filter((p) => {
      const name = p.split("/").pop()?.replace("-agent.ts", "") ?? "";
      return !playbooksDoc.includes(name) && name.length > 0;
    })
    .map((p) => {
      const name = p.split("/").pop()?.replace("-agent.ts", "") ?? p;
      return {
        category: "new_api_route" as const,
        path: p,
        description: `Agent \`${name}\` has no corresponding response playbook in PLAYBOOKS.md`,
        affectedDocs: ["docs/PLAYBOOKS.md"],
      };
    });
}

function extractEnvVarNames(fileContent: string): string[] {
  const matches = fileContent.match(/\b([A-Z][A-Z0-9_]{2,})\s*:\s*z\./g) ?? [];

  return [
    ...new Set(
      matches
        .map((m) => m.replace(/\s*:\s*z\.$/, "").trim())
        .filter((name) => name.includes("_") && name.length >= 4),
    ),
  ];
}

function detectNewEnvValidators(
  repo: RepoStructure,
  opsDoc: string,
): DriftItem[] {
  const validatorPaths = repo.allPaths.filter(
    (p) =>
      p.startsWith("packages/validators/src/") &&
      p.endsWith("-env.ts") &&
      !p.endsWith("index.ts"),
  );

  const items: DriftItem[] = [];

  for (const validatorPath of validatorPaths) {
    const fileContent = repo.keyFiles.find(
      (f) => f.path === validatorPath,
    )?.content;

    if (!fileContent) {
      console.warn(
        JSON.stringify({
          level: "warn",
          agent: "docs",
          event: "validator_content_missing",
          path: validatorPath,
          message: "Validator file not in key files — cannot extract env vars",
        }),
      );
      continue;
    }

    const envVarNames = extractEnvVarNames(fileContent);
    if (envVarNames.length === 0) continue;

    const undocumentedVars = envVarNames.filter(
      (varName) => !opsDoc.includes(varName),
    );

    if (undocumentedVars.length > 0) {
      const validatorName =
        validatorPath.split("/").pop()?.replace(".ts", "") ?? validatorPath;
      items.push({
        category: "new_env_var" as const,
        path: validatorPath,
        description: `Validator \`${validatorName}\` has undocumented env vars: ${undocumentedVars.map((v) => `\`${v}\``).join(", ")} — add to OPERATIONS.md Environment Variables`,
        affectedDocs: ["docs/OPERATIONS.md"],
      });
    }
  }

  return items;
}

function detectNewCronJobs(repo: RepoStructure, opsDoc: string): DriftItem[] {
  return repo.allPaths
    .filter((p) => p.includes("/cron/") && p.endsWith("route.ts"))
    .filter((p) => {
      const match = /app(\/api\/cron\/[^/]+(?:\/[^/]+)*)\/route\.ts$/.exec(p);
      if (!match?.[1]) return false;
      return !opsDoc.includes(match[1]);
    })
    .map((p) => {
      const match = /app(\/api\/cron\/[^/]+(?:\/[^/]+)*)\/route\.ts$/.exec(p);
      const route = match?.[1] ?? p;
      return {
        category: "new_cron" as const,
        path: p,
        description: `Cron route \`${route}\` is not mentioned in OPERATIONS.md`,
        affectedDocs: ["docs/OPERATIONS.md"],
      };
    });
}

function detectNewWebhookHandlers(
  repo: RepoStructure,
  opsDoc: string,
): DriftItem[] {
  return repo.allPaths
    .filter((p) => p.includes("/webhooks/") && p.endsWith("route.ts"))
    .filter((p) => {
      const match = /app(\/api\/webhooks\/[^/]+(?:\/[^/]+)*)\/route\.ts$/.exec(
        p,
      );
      if (!match?.[1]) return false;
      return !opsDoc.includes(match[1]);
    })
    .map((p) => {
      const match = /app(\/api\/webhooks\/[^/]+(?:\/[^/]+)*)\/route\.ts$/.exec(
        p,
      );
      const route = match?.[1] ?? p;
      return {
        category: "new_webhook_handler" as const,
        path: p,
        description: `Webhook handler \`${route}\` is not mentioned in OPERATIONS.md`,
        affectedDocs: ["docs/OPERATIONS.md"],
      };
    });
}

function detectReadmeIssues(repo: RepoStructure): DriftItem[] {
  const items: DriftItem[] = [];

  const docTargetDirs = [
    ...new Set(
      repo.allPaths
        .filter(
          (p) =>
            (p.startsWith("packages/") ||
              p.startsWith("apps/") ||
              p.startsWith("platform/")) &&
            p.includes("/") &&
            !p.includes("node_modules") &&
            !p.includes("/.") &&
            !p.includes("/dist/") &&
            !p.includes("/.next/"),
        )
        .map((p) => {
          const parts = p.split("/");
          return parts.slice(0, 2).join("/");
        }),
    ),
  ];

  for (const dir of docTargetDirs) {
    const secondSegment = dir.split("/")[1] ?? "";
    if (secondSegment.includes(".")) continue;

    const readmePath = `${dir}/README.md`;
    if (!repo.allPaths.includes(readmePath)) {
      items.push({
        category: "missing_readme" as const,
        path: readmePath,
        description: `\`${dir}\` has no README.md`,
        affectedDocs: [readmePath],
      });
    } else {
      const readmeFile = repo.keyFiles.find((f) => f.path === readmePath);
      if (readmeFile !== undefined && readmeFile.content.trim().length < 100) {
        items.push({
          category: "empty_readme" as const,
          path: readmePath,
          description: `\`${readmePath}\` exists but appears empty or placeholder`,
          affectedDocs: [readmePath],
        });
      }
    }
  }

  return items;
}

// ─────────────────────────────────────────────
// Existing doc lookup — for drift detection only
// Not used for the actual commit (appendToFile fetches fresh content)
// ─────────────────────────────────────────────

function getExistingDoc(path: string, repo: RepoStructure): string {
  return repo.keyFiles.find((f) => f.path === path)?.content ?? "";
}

// ─────────────────────────────────────────────
// Claude changelog generation
// ─────────────────────────────────────────────

type TextBlock = Extract<ContentBlock, { type: "text" }>;

interface DocChangelogSpec {
  docPath: string;
  systemPrompt: string;
  buildPrompt: (
    items: { description: string; path: string }[],
    existingDoc: string,
    repo: RepoStructure,
  ) => string;
}

const DOC_CHANGELOG_SPECS: DocChangelogSpec[] = [
  {
    docPath: "docs/ARCHITECTURE.md",
    systemPrompt: ARCHITECTURE_CHANGELOG_SYSTEM_PROMPT,
    buildPrompt: buildArchitectureChangelogPrompt,
  },
  {
    docPath: "docs/OPERATIONS.md",
    systemPrompt: OPERATIONS_CHANGELOG_SYSTEM_PROMPT,
    buildPrompt: buildOperationsChangelogPrompt,
  },
  {
    docPath: "docs/PLAYBOOKS.md",
    systemPrompt: PLAYBOOKS_CHANGELOG_SYSTEM_PROMPT,
    buildPrompt: buildPlaybooksChangelogPrompt,
  },
];

async function generateChangelogBullets(
  spec: DocChangelogSpec,
  driftItems: DriftItem[],
  existingDoc: string,
  repo: RepoStructure,
): Promise<string> {
  const client = getAnthropicClient();
  const userPrompt = spec.buildPrompt(driftItems, existingDoc, repo);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "docs",
      event: "generating_changelog",
      doc: spec.docPath,
      driftItemCount: driftItems.length,
    }),
  );

  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 1024,
    system: spec.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const blocks: ContentBlock[] = message.content;

  return blocks
    .filter((block: ContentBlock): block is TextBlock => block.type === "text")
    .map((block: TextBlock) => block.text)
    .join("")
    .trim();
}

// ─────────────────────────────────────────────
// Changelog block builder
//
// Produces the content block that gets appended to the doc.
// appendToFile handles stripping the previous block via dedupeMarker.
// ─────────────────────────────────────────────

const DRIFT_BLOCK_MARKER = "## Documentation Drift —";

function buildChangelogBlock(bullets: string, date: string): string {
  return `---

## Documentation Drift — ${date}

> Auto-detected by platform-agent · Review and update the sections above · Remove this block when resolved

${bullets}
`;
}

// ─────────────────────────────────────────────
// Drift report builder
// ─────────────────────────────────────────────

function buildDriftReport(
  allItems: DriftItem[],
  date: string,
  branch: string,
  repo: RepoStructure,
): string {
  const byCategory = allItems.reduce<Record<string, DriftItem[]>>(
    (acc, item) => {
      const existing = acc[item.category];
      if (existing) {
        existing.push(item);
      } else {
        acc[item.category] = [item];
      }
      return acc;
    },
    {},
  );

  const categoryLabels: Record<string, string> = {
    new_api_route: "New API Routes (undocumented)",
    new_package: "New Packages (undocumented)",
    new_env_var: "New or Undocumented Env Vars",
    new_cron: "New Cron Jobs (undocumented)",
    new_webhook_handler: "New Webhook Handlers (undocumented)",
    missing_readme: "Missing README.md Files",
    empty_readme: "Empty or Placeholder README.md Files",
  };

  const sections = Object.entries(byCategory)
    .map(([category, items]) => {
      const label = categoryLabels[category] ?? category;
      const rows = items
        .map(
          (item) =>
            `- \`${item.path}\`\n  ${item.description}\n  → Update: ${item.affectedDocs.join(", ")}`,
        )
        .join("\n");
      return `### ${label}\n\n${rows}`;
    })
    .join("\n\n---\n\n");

  const actionSummary = [
    byCategory.new_api_route?.length
      ? `- Add ${byCategory.new_api_route.length} new route(s) to ARCHITECTURE.md API Routes table and OPERATIONS.md`
      : null,
    byCategory.new_package?.length
      ? `- Add ${byCategory.new_package.length} new package(s) to ARCHITECTURE.md Monorepo Structure section`
      : null,
    byCategory.new_env_var?.length
      ? `- Document ${byCategory.new_env_var.length} undocumented env var(s) in OPERATIONS.md Environment Variables table`
      : null,
    byCategory.new_cron?.length
      ? `- Add ${byCategory.new_cron.length} new cron job(s) to OPERATIONS.md Cron Jobs table`
      : null,
    byCategory.new_webhook_handler?.length
      ? `- Add ${byCategory.new_webhook_handler.length} new webhook handler(s) to OPERATIONS.md Webhook Integrations table`
      : null,
    byCategory.missing_readme?.length
      ? `- Create README.md for ${byCategory.missing_readme.length} package(s) — use Claude Code documentation prompt`
      : null,
    byCategory.empty_readme?.length
      ? `- Fill in ${byCategory.empty_readme.length} empty README.md file(s) — use Claude Code documentation prompt`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `# Documentation Drift Report — ${date}

**Branch**: \`${branch}\`
**Scanned at**: ${repo.scannedAt}
**Total items requiring attention**: ${allItems.length}

## Action Items

${actionSummary}

> Affected docs have a dated changelog block appended at the bottom.
> Remove the block once you've addressed the items.
> For deep documentation regeneration, use the Claude Code documentation prompt.

---

## Drift Details

${sections}

---

## Repository Snapshot

| Metric | Count |
|---|---|
| API routes | ${repo.allPaths.filter((p) => p.includes("/api/") && p.endsWith("route.ts")).length} |
| Workspace packages | ${repo.allPaths.filter((p) => p.endsWith("/package.json") && (p.startsWith("packages/") || p.startsWith("apps/") || p.startsWith("platform/"))).length} |
| Env validators | ${repo.allPaths.filter((p) => p.startsWith("packages/validators/src/") && p.endsWith("-env.ts")).length} |
| Cron jobs | ${repo.allPaths.filter((p) => p.includes("/cron/") && p.endsWith("route.ts")).length} |
| Missing READMEs | ${byCategory.missing_readme?.length ?? 0} |
| Empty READMEs | ${byCategory.empty_readme?.length ?? 0} |

---
*Generated by platform-agent · Structural diff + targeted Claude changelog*
*Use the Claude Code documentation prompt for full regeneration*
`;
}

// ─────────────────────────────────────────────
// Main agent
// ─────────────────────────────────────────────

export async function runDocsAgent(branch = "dev"): Promise<DocsAgentResult> {
  const startTime = Date.now();
  const filesUpdated: string[] = [];
  const filesSkipped: string[] = [];
  const errors: string[] = [];

  console.log(
    JSON.stringify({ level: "info", agent: "docs", event: "started", branch }),
  );

  // Step 1: Scan repo
  let repo: RepoStructure;
  try {
    repo = await scanRepo(branch);
  } catch (err) {
    const message = `Repo scan failed: ${String(err)}`;
    console.error(
      JSON.stringify({
        level: "error",
        agent: "docs",
        step: "scan",
        error: message,
      }),
    );
    return {
      ranAt: new Date().toISOString(),
      branch,
      filesUpdated: [],
      filesSkipped: [],
      errors: [message],
      durationMs: Date.now() - startTime,
    };
  }

  // Step 2: Read existing docs from keyFiles — used ONLY for drift detection
  // and as context for the Claude prompt. The actual commit uses appendToFile
  // which independently fetches the current content via the Blobs API.
  const archDoc = getExistingDoc("docs/ARCHITECTURE.md", repo);
  const opsDoc = getExistingDoc("docs/OPERATIONS.md", repo);
  const playbooksDoc = getExistingDoc("docs/PLAYBOOKS.md", repo);

  // Step 3: Run all structural detectors — pure functions, zero cost
  const allItems: DriftItem[] = [
    ...detectNewApiRoutes(repo, archDoc, opsDoc),
    ...detectNewPackages(repo, archDoc),
    ...detectNewIncidentTypes(repo, playbooksDoc),
    ...detectNewEnvValidators(repo, opsDoc),
    ...detectNewCronJobs(repo, opsDoc),
    ...detectNewWebhookHandlers(repo, opsDoc),
    ...detectReadmeIssues(repo),
  ];

  const date =
    new Date().toISOString().split("T")[0] ??
    new Date().toISOString().slice(0, 10);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "docs",
      event: "structural_diff_complete",
      totalItems: allItems.length,
      byCategory: allItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {}),
    }),
  );

  // Step 4: Clean exit if nothing changed — no LLM, no commits
  if (allItems.length === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "docs",
        event: "no_drift",
        message: "No structural drift detected — docs are current",
      }),
    );
    filesSkipped.push("all docs (no drift detected)");

    return {
      ranAt: new Date().toISOString(),
      branch,
      filesUpdated,
      filesSkipped,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  // Step 5: Drift found — call Claude once per affected doc, then appendToFile.
  //
  // appendToFile:
  //   1. Fetches current content via GitHub Contents API (with Blobs fallback)
  //   2. Strips any previous "## Documentation Drift —" block (dedupeMarker)
  //   3. Appends the new changelog block
  //   4. Commits with the existing file SHA
  //
  // This is safe for docs of any size — no 1MB truncation risk.
  for (const spec of DOC_CHANGELOG_SPECS) {
    const docItems = allItems.filter((item) =>
      item.affectedDocs.includes(spec.docPath),
    );

    if (docItems.length === 0) {
      filesSkipped.push(spec.docPath);
      continue;
    }

    // Use scanRepo's cached content for the Claude prompt only
    const existingDocForPrompt = getExistingDoc(spec.docPath, repo);

    if (!existingDocForPrompt) {
      console.log(
        JSON.stringify({
          level: "info",
          agent: "docs",
          event: "doc_missing",
          file: spec.docPath,
          message: "No existing doc — skipping. Create the doc manually first.",
        }),
      );
      filesSkipped.push(spec.docPath);
      continue;
    }

    try {
      const changelogBullets = await generateChangelogBullets(
        spec,
        docItems,
        existingDocForPrompt,
        repo,
      );

      // appendToFile fetches the actual current content independently,
      // handling large files correctly via the Git Blobs API fallback.
      await appendToFile(
        spec.docPath,
        buildChangelogBlock(changelogBullets, date),
        `docs(drift): ${spec.docPath.split("/").pop()} — ${docItems.length} change(s) ${date} [platform-agent]`,
        DRIFT_BLOCK_MARKER,
      );

      filesUpdated.push(spec.docPath);

      console.log(
        JSON.stringify({
          level: "info",
          agent: "docs",
          event: "changelog_appended",
          file: spec.docPath,
          itemCount: docItems.length,
        }),
      );
    } catch (err) {
      const message = `${spec.docPath} changelog failed: ${String(err)}`;
      errors.push(message);
      filesSkipped.push(spec.docPath);
      console.error(
        JSON.stringify({
          level: "error",
          agent: "docs",
          file: spec.docPath,
          error: message,
        }),
      );
    }
  }

  // Step 6: Commit drift report (new file each time — no append needed)
  try {
    const reportPath = `docs/drift-reports/${date}-drift-report.md`;
    await commitFile(
      reportPath,
      buildDriftReport(allItems, date, branch, repo),
      `docs(drift-report): ${allItems.length} item(s) — ${date} [platform-agent]`,
    );
    filesUpdated.push(reportPath);
  } catch (err) {
    errors.push(`Drift report commit failed: ${String(err)}`);
  }

  const result: DocsAgentResult = {
    ranAt: new Date().toISOString(),
    branch,
    filesUpdated,
    filesSkipped,
    errors,
    durationMs: Date.now() - startTime,
  };

  console.log(
    JSON.stringify({
      level: "info",
      agent: "docs",
      event: "complete",
      ...result,
    }),
  );

  return result;
}
