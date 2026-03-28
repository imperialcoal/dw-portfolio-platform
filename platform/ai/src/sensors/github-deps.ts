// Dependency sensor — reads Dependabot PRs and security alerts.
// No LLM calls. Pure GitHub API data retrieval.

import type {
  DependabotPR,
  DependencyEcosystem,
  DependencyUpdateType,
  SecurityAlertWithPR,
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

function parseDependabotTitle(title: string): {
  packageName: string;
  fromVersion: string | null;
  toVersion: string | null;
  updateType: DependencyUpdateType;
  isMajor: boolean;
} {
  const singleMatch =
    /^(?:chore\(deps(?:-dev)?\):\s+)?[Bb]ump\s+(.+?)\s+from\s+([\w.+-]+)\s+to\s+([\w.+-]+)/i.exec(
      title,
    );

  if (singleMatch?.[1] && singleMatch[2] && singleMatch[3]) {
    const packageName = singleMatch[1].trim();
    const fromVersion = singleMatch[2];
    const toVersion = singleMatch[3];

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
  return "npm";
}

interface GitHubPR {
  number: number;
  title: string;
  html_url: string;
  labels: { name: string }[];
  created_at: string;
  user: { login: string };
  head: { ref: string };
}

interface GitHubDependabotAlert {
  number: number;
  state: "open" | "dismissed" | "fixed" | "auto_dismissed";
  dependency: {
    package: { ecosystem: string; name: string };
    manifest_path: string;
    scope: "runtime" | "development" | null;
  };
  security_advisory: {
    ghsa_id: string;
    cve_id: string | null;
    summary: string;
    // GitHub Dependabot alerts API uses these exact values
    severity: "low" | "medium" | "high" | "critical";
    vulnerable_version_range: string;
  };
  security_vulnerability: {
    first_patched_version: { identifier: string } | null;
  };
  html_url: string;
  auto_dismissed_at: string | null;
}

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
      hasAnalysis: false,
    };
  });
}

/**
 * Fetches open Dependabot security vulnerability alerts via GitHub API.
 *
 * Note: The Dependabot alerts API uses "low" | "medium" | "high" | "critical"
 * (not "moderate") — this matches our SecurityAlertWithPR.severity type exactly.
 * The "moderate" value only appears in GitHub's security advisory CVSS data,
 * not in the dependabot/alerts endpoint.
 */
export async function fetchSecurityAlerts(
  prs: DependabotPR[],
): Promise<SecurityAlertWithPR[]> {
  const token = config.devops.GITHUB_TOKEN;
  if (!token) return [];

  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/dependabot/alerts?state=open&per_page=100`,
    { headers: getHeaders() },
  );

  if (!res.ok) {
    if (res.status === 403 || res.status === 404) {
      console.warn(
        JSON.stringify({
          level: "warn",
          sensor: "github-deps",
          event: "security_alerts_unavailable",
          status: res.status,
          message: "GitHub token may lack security_events scope",
        }),
      );
      return [];
    }
    console.error(
      JSON.stringify({
        level: "error",
        sensor: "github-deps",
        event: "fetch_security_alerts_failed",
        status: res.status,
      }),
    );
    return [];
  }

  const alerts = (await res.json()) as GitHubDependabotAlert[];

  return alerts
    .filter((alert) => alert.state === "open")
    .map((alert): SecurityAlertWithPR => {
      const packageName = alert.dependency.package.name;

      const fixPR =
        prs.find(
          (pr) =>
            pr.packageName.toLowerCase().includes(packageName.toLowerCase()) ||
            packageName.toLowerCase().includes(pr.packageName.toLowerCase()),
        ) ?? null;

      // The Dependabot alerts API severity field matches our type directly
      const severity = alert.security_advisory.severity;

      return {
        alertId: String(alert.number),
        packageName,
        ecosystem: alert.dependency.package.ecosystem,
        severity,
        identifier:
          alert.security_advisory.cve_id ?? alert.security_advisory.ghsa_id,
        summary: alert.security_advisory.summary,
        vulnerableRange: alert.security_advisory.vulnerable_version_range,
        fixedVersion:
          alert.security_vulnerability.first_patched_version?.identifier ??
          null,
        fixPR,
        noFixAvailable:
          alert.security_vulnerability.first_patched_version === null,
        alertUrl: alert.html_url,
        incidentId: null,
      };
    });
}

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
    return { success: false, error: error.message ?? `HTTP ${res.status}` };
  }

  const data = (await res.json()) as { sha?: string };
  return { success: true, mergeCommitSha: data.sha };
}
