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

// ─────────────────────────────────────────────
// Retry helper for transient GitHub API failures
//
// Only retries conditions likely to self-resolve: 429 (rate limit), 403 with
// a secondary-rate-limit body (GitHub's abuse-detection mechanism, distinct
// from a real permissions 403), and 5xx. A genuine 403 (bad token scope) or
// 422 (validation error) retrying would just fail the same way three times
// slower, so those throw immediately.
//
// This exists because of a real incident: 4 Terraform-workflow incidents
// (2026-06-08/15) got a committed incident doc + Redis record but no GitHub
// issue, because createIssue() threw once and Promise.allSettled in the
// calling agent let the rest of the fan-out proceed anyway. Root cause was
// never confirmed (no logs survived), but the leading theory is a burst of
// near-simultaneous CI/Terraform/Dependabot activity during production
// Supabase provisioning tripped GitHub's secondary rate limit on issue
// creation specifically. This retry doesn't guarantee it can't happen again
// (see githubIssueError on IncidentRecord for the visibility half of the fix),
// but it closes the most likely transient cause.
// ─────────────────────────────────────────────

const ISSUE_CREATE_MAX_ATTEMPTS = 3;
const ISSUE_CREATE_BASE_DELAY_MS = 500;

function isRetryableStatus(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status >= 500) return true;
  if (status === 403 && /rate limit/i.test(body)) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractInvalidLabels(status: number, body: string): string[] | null {
  if (status !== 422) return null;
  try {
    const parsed = JSON.parse(body) as {
      errors?: {
        resource?: string;
        field?: string;
        code?: string;
        value?: string;
      }[];
    };
    const invalid = (parsed.errors ?? [])
      .filter(
        (e) =>
          e.resource === "Label" && e.field === "name" && e.code === "invalid",
      )
      .map((e) => e.value)
      .filter((v): v is string => typeof v === "string");
    return invalid.length > 0 ? invalid : null;
  } catch {
    return null;
  }
}

/**
 * Creates a GitHub issue with labels from the AI analysis.
 * Returns the created issue's URL and number.
 *
 * Retries up to ISSUE_CREATE_MAX_ATTEMPTS times with exponential backoff on
 * rate-limit/5xx responses only. Throws immediately on non-retryable errors
 * (bad auth, validation) so the caller's Promise.allSettled fan-out isn't
 * held up for something a retry can't fix.
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

  let effectiveLabels = labels;

  const body = `## Summary\n${analysis.summary}\n\n## Root Cause\n${analysis.rootCause}\n\n## Impact\n${analysis.impact}\n\n## Suggested Fix\n${analysis.suggestedFix}\n\n---\n*Created by platform-agent*`;

  let lastError = "unknown error";

  for (let attempt = 1; attempt <= ISSUE_CREATE_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${GITHUB_API}/repos/${getRepo()}/issues`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ title, body, labels: effectiveLabels }),
    });

    if (res.ok) {
      const issue = (await res.json()) as { html_url: string; number: number };
      return { url: issue.html_url, number: issue.number };
    }

    const errBody = await res.text();
    lastError = `HTTP ${res.status}: ${errBody.slice(0, 300)}`;

    const invalidLabels = extractInvalidLabels(res.status, errBody);
    if (invalidLabels && invalidLabels.length > 0) {
      const before = effectiveLabels.length;
      effectiveLabels = effectiveLabels.filter(
        (l) => !invalidLabels.includes(l),
      );
      console.error(
        JSON.stringify({
          level: "error",
          action: "create_issue",
          attempt,
          status: res.status,
          event: "dropping_invalid_labels",
          invalidLabels,
          remainingLabels: effectiveLabels.length,
        }),
      );
      // Deterministic fix, not a transient failure — retry immediately,
      // no backoff needed, as long as we actually dropped something.
      if (effectiveLabels.length < before) continue;
    }

    const shouldRetry =
      attempt < ISSUE_CREATE_MAX_ATTEMPTS &&
      isRetryableStatus(res.status, errBody);

    console.error(
      JSON.stringify({
        level: "error",
        action: "create_issue",
        attempt,
        status: res.status,
        willRetry: shouldRetry,
        error: lastError,
      }),
    );

    if (!shouldRetry) {
      throw new Error(`Failed to create issue: ${lastError}`);
    }

    await sleep(ISSUE_CREATE_BASE_DELAY_MS * 2 ** (attempt - 1));
  }

  throw new Error(`Failed to create issue: ${lastError}`);
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
