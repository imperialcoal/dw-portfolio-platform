// Repo scanner — reads repository structure and key files via GitHub API.
// Used exclusively by the documentation agent.
// Never called from Edge routes — Node.js only.

import type { RepoFile, RepoStructure } from "@dw/contracts";
import { config } from "@dw/config";

const GITHUB_API = "https://api.github.com";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const token = config.devops.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function getRepo(): string {
  const repo = config.devops.GITHUB_REPO;
  if (!repo) throw new Error("GITHUB_REPO is not set");
  return repo;
}

async function fetchFileContent(path: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${getRepo()}/contents/${path}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return "";

  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return "";

  const clean = data.content.replace(/\n/g, "");
  return Buffer.from(clean, "base64").toString("utf-8");
}

async function fetchRepoTree(branch: string): Promise<string[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/git/trees/${branch}?recursive=1`,
    { headers: getHeaders() },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    tree: { path: string; type: string }[];
    truncated?: boolean;
  };

  if (data.truncated) {
    console.warn(
      JSON.stringify({
        level: "warn",
        sensor: "repo",
        event: "tree_truncated",
        message:
          "Repo tree was truncated — large repos may have incomplete structure",
      }),
    );
  }

  return data.tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path);
}

// ─────────────────────────────────────────────
// Key file selection
//
// Files are split into two tiers:
//
// GUARANTEED — always fetched regardless of count:
//   - Target docs (ARCHITECTURE, OPERATIONS, PLAYBOOKS) — primary input
//   - All env validator files — needed for dynamic env var extraction
//   - Package READMEs — needed for empty README detection
//
// BEST_EFFORT — fetched up to MAX_BEST_EFFORT cap after guaranteed files:
//   - Root config files, package.json files, route files, platform indexes
//
// This prevents validator files from being dropped when other files
// fill the cap first.
// ─────────────────────────────────────────────

const MAX_BEST_EFFORT = 35;
const MAX_FILE_CHARS = 6_000;
const MAX_DOC_CHARS = 12_000;

const TARGET_DOCS = [
  "docs/ARCHITECTURE.md",
  "docs/OPERATIONS.md",
  "docs/PLAYBOOKS.md",
];

function selectKeyFiles(allPaths: string[]): string[] {
  // ── Tier 1: Guaranteed files ──────────────────────────────────────────────

  // Main docs — always first
  const guaranteed = TARGET_DOCS.filter((p) => allPaths.includes(p));

  // All env validator files — needed for dynamic extraction
  const validatorFiles = allPaths.filter(
    (p) =>
      p.startsWith("packages/validators/src/") &&
      p.endsWith("-env.ts") &&
      !p.endsWith("index.ts"),
  );
  for (const p of validatorFiles) {
    if (!guaranteed.includes(p)) guaranteed.push(p);
  }

  // Package/app/platform README files — needed for empty README detection
  const readmeFiles = allPaths.filter(
    (p) =>
      p.endsWith("/README.md") &&
      (p.startsWith("packages/") ||
        p.startsWith("apps/") ||
        p.startsWith("platform/")) &&
      p.split("/").length === 3,
  );
  for (const p of readmeFiles) {
    if (!guaranteed.includes(p)) guaranteed.push(p);
  }

  // ── Tier 2: Best-effort files (up to cap) ────────────────────────────────

  const bestEffort: string[] = [];
  const guaranteedSet = new Set(guaranteed);

  const addBestEffort = (paths: string[]) => {
    for (const p of paths) {
      if (
        !guaranteedSet.has(p) &&
        !bestEffort.includes(p) &&
        bestEffort.length < MAX_BEST_EFFORT
      ) {
        bestEffort.push(p);
      }
    }
  };

  // Root-level config files
  addBestEffort(
    allPaths.filter(
      (p) =>
        !p.includes("/") &&
        (p.endsWith(".json") || p.endsWith(".md") || p.endsWith(".ts")),
    ),
  );

  // All workspace package.json files (workspace structure)
  addBestEffort(
    allPaths.filter((p) => p.endsWith("/package.json") || p === "package.json"),
  );

  // Route files (detect new undocumented routes)
  addBestEffort(
    allPaths
      .filter((p) => p.includes("/api/") && p.endsWith("route.ts"))
      .slice(0, 20),
  );

  // Vercel/CI config (cron schedule, workflow changes)
  addBestEffort(
    allPaths.filter(
      (p) => p === "vercel.json" || p === ".github/workflows/ci.yml",
    ),
  );

  return [...guaranteed, ...bestEffort];
}

// ─────────────────────────────────────────────
// Main scanner
// ─────────────────────────────────────────────

export async function scanRepo(branch = "dev"): Promise<RepoStructure> {
  console.log(
    JSON.stringify({
      level: "info",
      sensor: "repo",
      event: "scan_started",
      branch,
    }),
  );

  const allPaths = await fetchRepoTree(branch);

  console.log(
    JSON.stringify({
      level: "info",
      sensor: "repo",
      event: "tree_fetched",
      totalFiles: allPaths.length,
    }),
  );

  const keyFilePaths = selectKeyFiles(allPaths);

  const BATCH_SIZE = 8;
  const keyFiles: RepoFile[] = [];

  for (let i = 0; i < keyFilePaths.length; i += BATCH_SIZE) {
    const batch = keyFilePaths.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (path) => {
        const content = await fetchFileContent(path);
        return { path, content };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { path, content } = result.value;
        const isTargetDoc = TARGET_DOCS.includes(path);
        const isReadme = path.endsWith("README.md");
        const limit = isTargetDoc ? MAX_DOC_CHARS : MAX_FILE_CHARS;

        // Always include READMEs (even empty — empty content is the signal)
        // Always include validator files (even if short — content needed for extraction)
        // For other files, skip if empty
        const isGuaranteedType =
          isReadme || path.startsWith("packages/validators/src/");
        if (content.length > 0 || isGuaranteedType) {
          keyFiles.push({
            path,
            content:
              content.length > limit
                ? content.slice(0, limit) +
                  `\n\n... [truncated — ${content.length - limit} chars omitted]`
                : content,
          });
        }
      }
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      sensor: "repo",
      event: "scan_complete",
      keyFilesRead: keyFiles.length,
      totalPaths: allPaths.length,
      validatorFilesRead: keyFiles.filter((f) =>
        f.path.startsWith("packages/validators/src/"),
      ).length,
      docsFound: TARGET_DOCS.filter((d) => keyFiles.some((f) => f.path === d)),
    }),
  );

  return { allPaths, keyFiles, branch, scannedAt: new Date().toISOString() };
}
