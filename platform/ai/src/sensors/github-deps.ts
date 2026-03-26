// Dependency sensor — reads Dependabot PRs and security alerts.
// No LLM calls. Pure GitHub API data retrieval.

import type {
  DependabotPR,
  DependencyEcosystem,
  DependencyUpdateType,
} from "@dw/contracts";
import { config } from "@dw/config";

const GITHUB_API = "https://api.github.com";

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

// ─────────────────────────────────────────────
// Dependabot PR parser
//
// Supports both the legacy Dependabot title format and the
// chore(deps) convention configured in dependabot.yml:
//
//   Legacy:  "Bump @trpc/client from 11.13.4 to 11.15.0"
//   Current: "chore(deps): bump @trpc/client from 11.13.4 to 11.15.0"
//   Grouped: "chore(deps): bump the trpc group with 2 updates"
// ─────────────────────────────────────────────

function parseDependabotTitle(title: string): {
  packageName: string;
  fromVersion: string | null;
  toVersion: string | null;
  updateType: DependencyUpdateType;
  isMajor: boolean;
} {
  // Match both "Bump X from Y to Z" and "chore(deps): bump X from Y to Z ..."
  // The trailing portion ("in the GROUP group", "in /path") is intentionally ignored.
  const singleMatch =
    /^(?:chore\(deps(?:-dev)?\):\s+)?[Bb]ump\s+(.+?)\s+from\s+([\w.+-]+)\s+to\s+([\w.+-]+)/i.exec(
      title,
    );

  if (singleMatch?.[1] && singleMatch[2] && singleMatch[3]) {
    const packageName = singleMatch[1].trim();
    const fromVersion = singleMatch[2];
    const toVersion = singleMatch[3];

    // Strip pre-release suffixes before comparing (e.g. "5.0.0-preview.3" → "5.0.0")
    const clean = (v: string) => v.replace(/[-+].*$/, "");
    const fromParts = clean(fromVersion).split(".").map(Number);
    const toParts = clean(toVersion).split(".").map(Number);

    const fromMajor = fromParts[0] ?? 0;
    const toMajor = toParts[0] ?? 0;
    const fromMinor = fromParts[1] ?? 0;
    const toMinor = toParts[1] ?? 0;

    let updateType: DependencyUpdateType;
    if (toMajor > fromMajor) {
      updateType = "major";
    } else if (toMinor > fromMinor) {
      updateType = "minor";
    } else {
      updateType = "patch";
    }

    return {
      packageName,
      fromVersion,
      toVersion,
      updateType,
      isMajor: updateType === "major",
    };
  }

  // Grouped bump: "chore(deps): bump the eslint group with 2 updates"
  const groupMatch =
    /^chore\(deps(?:-dev)?\):\s+bump\s+the\s+(.+?)\s+group\s+with\s+\d+\s+updates?/i.exec(
      title,
    );

  if (groupMatch?.[1]) {
    return {
      packageName: `${groupMatch[1].trim()} group`,
      fromVersion: null,
      toVersion: null,
      updateType: "unknown",
      isMajor: false,
    };
  }

  // Fallback — couldn't parse, use first word after "bump" as package name
  return {
    packageName:
      title
        .replace(/^(?:chore\(deps(?:-dev)?\):\s+)?[Bb]ump\s+/, "")
        .split(" ")[0] ?? title,
    fromVersion: null,
    toVersion: null,
    updateType: "unknown",
    isMajor: false,
  };
}

function detectEcosystem(
  labels: string[],
  branchName: string,
): DependencyEcosystem {
  if (labels.some((l) => l.includes("npm")) || branchName.includes("npm"))
    return "npm";
  if (labels.some((l) => l.includes("pip")) || branchName.includes("pip"))
    return "pip";
  if (labels.some((l) => l.includes("cargo")) || branchName.includes("cargo"))
    return "cargo";
  if (labels.some((l) => l.includes("maven")) || branchName.includes("maven"))
    return "maven";
  if (labels.some((l) => l.includes("nuget")) || branchName.includes("nuget"))
    return "nuget";
  return "npm"; // default for this project
}

// ─────────────────────────────────────────────
// GitHub API
// ─────────────────────────────────────────────

interface GitHubPR {
  number: number;
  title: string;
  html_url: string;
  labels: { name: string }[];
  created_at: string;
  user: { login: string };
  head: { ref: string };
}

/**
 * Fetches all open Dependabot pull requests for the repository.
 * Returns an empty array if GITHUB_TOKEN is not configured.
 */
export async function fetchDependabotPRs(): Promise<DependabotPR[]> {
  const token = config.devops.GITHUB_TOKEN;
  if (!token) return [];

  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/pulls?state=open&per_page=100`,
    { headers: getHeaders() },
  );

  if (!res.ok) {
    console.error(
      JSON.stringify({
        level: "error",
        sensor: "github-deps",
        status: res.status,
        message: "Failed to fetch PRs",
      }),
    );
    return [];
  }

  const prs = (await res.json()) as GitHubPR[];

  const dependabotPRs = prs.filter(
    (pr) =>
      pr.user.login === "dependabot[bot]" ||
      pr.head.ref.startsWith("dependabot/"),
  );

  return dependabotPRs.map((pr): DependabotPR => {
    const labelNames = pr.labels.map((l) => l.name);
    const parsed = parseDependabotTitle(pr.title);
    const ecosystem = detectEcosystem(labelNames, pr.head.ref);

    return {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      packageName: parsed.packageName,
      ecosystem,
      fromVersion: parsed.fromVersion,
      toVersion: parsed.toVersion,
      updateType: parsed.updateType,
      isMajor: parsed.isMajor,
      labels: labelNames,
      createdAt: pr.created_at,
      hasAnalysis: false, // populated by caller from Redis
    };
  });
}

/**
 * Merges a Dependabot PR using squash merge.
 * Returns success/failure and the merge commit SHA on success.
 */
export async function mergeDependabotPR(
  prNumber: number,
): Promise<{ success: boolean; mergeCommitSha?: string; error?: string }> {
  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({
        merge_method: "squash",
        commit_title: `chore: merge dependabot pr #${prNumber}`,
      }),
    },
  );

  if (!res.ok) {
    const error = (await res.json()) as { message?: string };
    return {
      success: false,
      error: error.message ?? `HTTP ${res.status}`,
    };
  }

  const data = (await res.json()) as { sha?: string };
  return { success: true, mergeCommitSha: data.sha };
}
