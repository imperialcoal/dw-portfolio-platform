// GitHub API actions — create issues, commit files, post PR comments.
// All config reads happen inside function bodies — no module-level side effects.

import type { AnalysisResult } from "@dw/llm";
import { config } from "@dw/config";
import { isDevopsConfigured } from "@dw/validators/devops-env";

const GITHUB_API = "https://api.github.com";

function getHeaders(): Record<string, string> {
  const token = config.devops.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function getRepo(): string {
  const repo = config.devops.GITHUB_REPO;
  if (!repo) throw new Error("GITHUB_REPO is not set");
  return repo;
}

function getBranch(): string {
  return config.devops.GITHUB_BRANCH ?? "dev";
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

interface ExistingFile {
  sha: string;
  content: string;
}

async function getExistingFile(path: string): Promise<ExistingFile | null> {
  const branch = getBranch();
  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/contents/${path}?ref=${branch}`,
    { headers: getHeaders() },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    sha: string;
    content?: string;
    size?: number;
    git_url?: string;
  };

  // Large file fallback via Git Blobs API (files > 1MB are truncated in Contents API)
  if (data.size && data.size > 1_000_000 && data.git_url) {
    const blobRes = await fetch(data.git_url, { headers: getHeaders() });
    if (!blobRes.ok) return null;
    const blob = (await blobRes.json()) as { sha: string; content: string };
    return {
      sha: blob.sha,
      content: Buffer.from(blob.content, "base64").toString("utf-8"),
    };
  }

  return {
    sha: data.sha,
    content: data.content
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : "",
  };
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Commits a file to the repository (create or update).
 */
export async function commitFile(
  path: string,
  content: string,
  message: string,
): Promise<void> {
  if (!isDevopsConfigured()) {
    console.info("[DevOps not configured] Skipping incident doc commit");
    return;
  }
  const existing = await getExistingFile(path).catch(() => null);

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch: getBranch(),
  };

  if (existing) {
    body.sha = existing.sha;
  }

  const res = await fetch(`${GITHUB_API}/repos/${getRepo()}/contents/${path}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(`Failed to commit ${path}: ${err.message ?? res.status}`);
  }
}

/**
 * Appends content to an existing file without replacing it.
 */
export async function appendToFile(
  path: string,
  appendContent: string,
  message: string,
  dedupeMarker?: string,
): Promise<void> {
  if (!isDevopsConfigured()) {
    console.info(
      "[DevOps not configured] Skipping append drift changelog entries",
    );
    return;
  }
  const existing = await getExistingFile(path).catch(() => null);

  let baseContent = existing?.content ?? "";

  if (dedupeMarker && baseContent.includes(dedupeMarker)) {
    const markerIdx = baseContent.indexOf(dedupeMarker);
    baseContent = baseContent.slice(0, markerIdx).trimEnd();
  }

  const newContent = baseContent
    ? `${baseContent}\n\n${appendContent}`
    : appendContent;

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(newContent).toString("base64"),
    branch: getBranch(),
  };

  if (existing) {
    body.sha = existing.sha;
  }

  const res = await fetch(`${GITHUB_API}/repos/${getRepo()}/contents/${path}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(
      `Failed to append to ${path}: ${err.message ?? res.status}`,
    );
  }
}

/**
 * Creates a GitHub issue with labels from the AI analysis.
 * Returns the created issue's URL and number.
 */
export async function createIssue(
  title: string,
  analysis: AnalysisResult,
  additionalLabels: string[] = [],
): Promise<{ url: string; number: number }> {
  if (!isDevopsConfigured()) {
    console.info("[DevOps not configured] Skipping GitHub issue creation");
    return { number: 0, url: "" };
  }

  const labels = [
    "platform-agent",
    "Created by AI platform agent",
    `severity:${analysis.severity}`,
    ...analysis.labels,
    ...additionalLabels,
  ];

  const body = `## Summary\n${analysis.summary}\n\n## Root Cause\n${analysis.rootCause}\n\n## Impact\n${analysis.impact}\n\n## Suggested Fix\n${analysis.suggestedFix}\n\n---\n*Created by platform-agent*`;

  const res = await fetch(`${GITHUB_API}/repos/${getRepo()}/issues`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ title, body, labels }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(`Failed to create issue: ${err.message ?? res.status}`);
  }

  const issue = (await res.json()) as { html_url: string; number: number };
  return { url: issue.html_url, number: issue.number };
}

/**
 * Closes a GitHub issue by number.
 *
 * Called by the manual resolve route when an admin resolves an incident
 * from the platform dashboard. This keeps GitHub Issues in sync with
 * Redis incident state — resolving in the dashboard also closes the issue.
 *
 * Fails silently if the issue is already closed or doesn't exist —
 * the Redis resolution still proceeds regardless.
 */
export async function closeGithubIssue(issueNumber: number): Promise<void> {
  if (!isDevopsConfigured()) {
    console.info("[DevOps not configured] Skipping GitHub issue close");
    return;
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/issues/${issueNumber}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ state: "closed" }),
    },
  );

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    // Log but don't throw — Redis resolution is more important than GitHub sync
    console.error(
      JSON.stringify({
        level: "error",
        action: "close_github_issue",
        issueNumber,
        error: err.message ?? `HTTP ${res.status}`,
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: "info",
        action: "close_github_issue",
        issueNumber,
        status: "closed",
      }),
    );
  }
}

/**
 * Posts an analysis comment on a pull request.
 */
export async function postPrComment(
  prNumber: number,
  analysis: AnalysisResult,
  type: "ci_failure" | "sentry_error" | "security_alert",
): Promise<void> {
  if (!isDevopsConfigured()) {
    console.info("[DevOps not configured] Skipping PR comment");
    return;
  }

  const typeLabel =
    type === "ci_failure"
      ? "CI Failure"
      : type === "security_alert"
        ? "Security Alert"
        : "Runtime Error";

  const severityEmoji: Record<AnalysisResult["severity"], string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  };

  const body = `## ${severityEmoji[analysis.severity]} ${typeLabel} Analysis

**Summary**: ${analysis.summary}

**Root Cause**: ${analysis.rootCause}

**Impact**: ${analysis.impact}

**Suggested Fix**:
${analysis.suggestedFix}

---
*Labels: ${analysis.labels.join(", ")}*
*Generated by platform-agent*`;

  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ body }),
    },
  );

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(
      `Failed to post PR comment on #${prNumber}: ${err.message ?? res.status}`,
    );
  }
}
