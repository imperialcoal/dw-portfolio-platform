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
// ─────────────────────────────────────────────

// Hard cap to stay within LLM context limits.
// IMPORTANT: Existing docs are always included first — they must be read
// for the drift analysis to work correctly.
const MAX_KEY_FILES = 45;
const MAX_FILE_CHARS = 6_000; // Docs can be long — give them more space

// Docs get a higher character limit since they're the primary input
const MAX_DOC_CHARS = 12_000;

const TARGET_DOCS = [
  "docs/ARCHITECTURE.md",
  "docs/OPERATIONS.md",
  "docs/PLAYBOOKS.md",
];

function selectKeyFiles(allPaths: string[]): string[] {
  const selected: string[] = [];

  const add = (paths: string[]) => {
    for (const p of paths) {
      if (!selected.includes(p) && selected.length < MAX_KEY_FILES) {
        selected.push(p);
      }
    }
  };

  // 1. ALWAYS include target docs first — these are the primary input
  add(TARGET_DOCS.filter((p) => allPaths.includes(p)));

  // 2. Root-level config files
  add(
    allPaths.filter(
      (p) =>
        !p.includes("/") &&
        (p.endsWith(".json") || p.endsWith(".md") || p.endsWith(".ts")),
    ),
  );

  // 3. All package.json files (workspace structure)
  add(
    allPaths.filter((p) => p.endsWith("/package.json") || p === "package.json"),
  );

  // 4. Route files (API shape — new routes = new docs needed)
  add(
    allPaths
      .filter((p) => p.includes("/api/") && p.endsWith("route.ts"))
      .slice(0, 15),
  );

  // 5. Database schema
  add(
    allPaths
      .filter((p) => p.includes("schema") && p.endsWith(".ts"))
      .slice(0, 5),
  );

  // 6. Key platform index files (show what's exported)
  add(
    allPaths.filter(
      (p) =>
        (p.includes("platform/ai/src/") ||
          p.includes("platform/runtime/src/")) &&
        p.endsWith("index.ts"),
    ),
  );

  // 7. Vercel/CI config (cron schedule changes, workflow changes)
  add(
    allPaths.filter(
      (p) => p === "vercel.json" || p === ".github/workflows/ci.yml",
    ),
  );

  // 8. Validator files (new env vars = potential doc updates needed)
  add(
    allPaths
      .filter(
        (p) => p.includes("packages/validators/src/") && p.endsWith(".ts"),
      )
      .slice(0, 8),
  );

  return selected.slice(0, MAX_KEY_FILES);
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
      if (result.status === "fulfilled" && result.value.content) {
        const { path, content } = result.value;
        // Target docs get a higher char limit — they're the primary input
        const isTargetDoc = TARGET_DOCS.includes(path);
        const limit = isTargetDoc ? MAX_DOC_CHARS : MAX_FILE_CHARS;
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

  console.log(
    JSON.stringify({
      level: "info",
      sensor: "repo",
      event: "scan_complete",
      keyFilesRead: keyFiles.length,
      totalPaths: allPaths.length,
      docsFound: TARGET_DOCS.filter((d) => keyFiles.some((f) => f.path === d)),
    }),
  );

  return { allPaths, keyFiles, branch, scannedAt: new Date().toISOString() };
}
