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
// Dependabot PR titles follow a consistent format:
//   "Bump <package> from <version> to <version> in <path>"
//   "Bump @scope/package from 1.2.3 to 2.0.0 in /packages/foo"
// ─────────────────────────────────────────────

function parseDependabotTitle(title: string): {
  packageName: string;
  fromVersion: string | null;
  toVersion: string | null;
  updateType: DependencyUpdateType;
  isMajor: boolean;
} {
  const match =
    /^[Bb]ump\s+(.+?)\s+from\s+([\d.]+\S*)\s+to\s+([\d.]+\S*)/i.exec(title);

  if (!match) {
    return {
      packageName: title.replace(/^[Bb]ump\s+/, "").split(" ")[0] ?? title,
      fromVersion: null,
      toVersion: null,
      updateType: "unknown",
      isMajor: false,
    };
  }

  const packageName = match[1] ?? "";
  const fromVersion = match[2] ?? "";
  const toVersion = match[3] ?? "";

  const fromMajor = parseInt(fromVersion.split(".")[0] ?? "0", 10);
  const toMajor = parseInt(toVersion.split(".")[0] ?? "0", 10);
  const fromMinor = parseInt(fromVersion.split(".")[1] ?? "0", 10);
  const toMinor = parseInt(toVersion.split(".")[1] ?? "0", 10);

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

  return dependabotPRs.map((pr) => {
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
 * Returns success/failure per PR.
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
