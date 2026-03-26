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

/**
 * Fetches the file SHA and content (if available) for an existing file.
 *
 * The GitHub Contents API returns content inline for files < 1MB.
 * For larger files, `content` is null and `encoding` is "none".
 * In that case we fall back to the Git Blobs API which has no size limit.
 *
 * Returns { sha, content } or null if the file doesn't exist.
 */
async function getExistingFile(
  path: string,
): Promise<{ sha: string; content: string } | null> {
  const branch = getBranch();
  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/contents/${path}?ref=${branch}`,
    { headers: getHeaders() },
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub Contents API error ${res.status} for ${path}`);
  }

  const data = (await res.json()) as {
    sha?: string;
    content?: string | null;
    encoding?: string;
  };

  if (!data.sha) return null;

  // Happy path — content inline (files < 1MB)
  if (data.content && data.encoding === "base64") {
    const decoded = Buffer.from(
      data.content.replace(/\n/g, ""),
      "base64",
    ).toString("utf-8");
    return { sha: data.sha, content: decoded };
  }

  // Fallback — file too large for Contents API, use Git Blobs API
  // This path handles files > 1MB and avoids the truncation bug.
  console.log(
    JSON.stringify({
      level: "info",
      action: "github.getExistingFile",
      event: "large_file_fallback",
      path,
      blobSha: data.sha,
    }),
  );

  const blobRes = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/git/blobs/${data.sha}`,
    {
      headers: {
        ...getHeaders(),
        // Use raw media type to get content without size limits
        Accept: "application/vnd.github.v3.raw",
      },
    },
  );

  if (!blobRes.ok) {
    throw new Error(
      `GitHub Blobs API error ${blobRes.status} for blob ${data.sha}`,
    );
  }

  const rawContent = await blobRes.text();
  return { sha: data.sha, content: rawContent };
}

// ─────────────────────────────────────────────
// Public actions
// ─────────────────────────────────────────────

/**
 * Creates or updates a file in the repository.
 *
 * If the file already exists, the existing SHA is fetched first (required
 * by the GitHub Contents API for updates). Uses the Git Blobs API fallback
 * for files larger than 1MB to avoid content truncation.
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
 *
 * Fetches the existing content (including large-file fallback),
 * strips any previous changelog block with the given marker (to avoid
 * accumulating duplicate blocks), then appends the new block.
 *
 * Used by the docs agent to append drift changelog entries.
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

  // Remove any previous block with the same marker to avoid accumulation
  // This handles re-running the docs agent on the same day
  if (dedupeMarker && baseContent.includes(dedupeMarker)) {
    const markerIdx = baseContent.indexOf(dedupeMarker);
    // Remove from the marker to end of file (trim trailing whitespace)
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
