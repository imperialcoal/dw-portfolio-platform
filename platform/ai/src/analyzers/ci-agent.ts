// CI failure agent — runs in Node.js runtime via /api/process/ci.
// Triggered by GitHub workflow_run webhook events (conclusion: failure).
//
// Key change from stateless version:
// Before calling the Anthropic API, this agent fetches the last 7 days of
// incidents from Redis, filters to CI failures on the same branch, and
// injects them into the prompt via buildCiFailureUserPrompt(). This lets
// Claude detect recurrence patterns rather than treating every failure as novel.
//
// Flow:
//   1. Validate job payload from QStash (already done by /api/process/ci)
//   2. Deduplicate by runId + commit/workflow pair
//   3. Fetch CI job logs from GitHub API
//   4. Normalize raw webhook payload → CiFailureEvent (via normalizeGitHubWorkflowRun)
//   5. Fetch recent branch incidents from Redis (NEW)
//   6. Analyze with Claude (with history context injected)
//   7. Fan out: PR comment / GitHub Issue / incident doc / email
//   8. Write incident record to Redis

import type { CiFailureEvent } from "@dw/contracts";
import { normalizeGitHubWorkflowRun } from "@dw/contracts";
import {
  ANALYSIS_MODEL,
  buildCiFailureUserPrompt,
  CI_FAILURE_SYSTEM_PROMPT,
  getAnthropicClient,
  parseAnalysisXml,
} from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue, postPrComment } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import {
  getIncidents,
  isDuplicate,
  logIncident,
  markIncidentOpen,
} from "../memory/redis";
import { fetchCiJobDetails } from "../sensors/github-ci";

// ─────────────────────────────────────────────
// Entry point
//
// `payload` is the raw `githubPayload` field from CiJobPayload —
// the original GitHub workflow_run webhook body passed through QStash.
// `repoFullName` is extracted separately by /api/process/ci from the
// validated CiJobPayload before calling this function.
// ─────────────────────────────────────────────

export async function runCiAgent(
  payload: Record<string, unknown>,
  repoFullName: string,
  isDemo = false,
): Promise<void> {
  // Extract the workflow run object for deduplication keys.
  // normalizeGitHubWorkflowRun() will do the full safe extraction below,
  // but we need runId early for the dedup check before fetching logs.
  const workflowRun =
    payload.workflow_run !== null &&
    typeof payload.workflow_run === "object" &&
    !Array.isArray(payload.workflow_run)
      ? (payload.workflow_run as Record<string, unknown>)
      : {};

  const runId =
    typeof workflowRun.id === "number"
      ? String(workflowRun.id)
      : typeof workflowRun.id === "string"
        ? workflowRun.id
        : "";

  const headSha =
    typeof workflowRun.head_sha === "string" ? workflowRun.head_sha : "";
  const workflowName =
    typeof workflowRun.name === "string" ? workflowRun.name : "CI";

  if (!runId) {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "ci",
        error: "Missing workflow_run.id in payload",
      }),
    );
    return;
  }

  // ── 1. Deduplication ──────────────────────────────────────────────────────

  const runDup = await isDuplicate("ci_failure", runId);
  if (runDup) {
    console.log(
      JSON.stringify({ level: "info", agent: "ci", event: "dedup_run", runId }),
    );
    return;
  }

  const commitWorkflowKey = `${headSha}:${workflowName}`;
  const commitDup = await isDuplicate("ci_failure", commitWorkflowKey);
  if (commitDup) {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "ci",
        event: "dedup_commit",
        runId,
        headSha,
      }),
    );
    return;
  }

  // ── 2. Fetch CI job logs ──────────────────────────────────────────────────
  //
  // fetchCiJobDetails(repo, runId) → Promise<string>
  // Returns a formatted string of failed job names and step names.
  // The sensor owns the GitHub API call and log formatting.

  const jobLogs = await fetchCiJobDetails(repoFullName, runId).catch(
    (err: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          agent: "ci",
          step: "fetch_logs",
          runId,
          error: String(err),
        }),
      );
      return "[logs unavailable — GitHub API error]";
    },
  );

  // ── 3. Normalize payload → typed CiFailureEvent ───────────────────────────
  //
  // normalizeGitHubWorkflowRun() safely extracts all fields from the raw
  // webhook body using the str() / num() / safeId() helpers in normalize.ts.
  // This is the correct place to do payload extraction — not with raw String()
  // casts on Record<string, unknown> which trigger @typescript-eslint/no-base-to-string.

  const event: CiFailureEvent = normalizeGitHubWorkflowRun(payload, jobLogs);

  // ── 4. Fetch recent branch incidents for contextual analysis ───────────────
  //
  // Pull the last 100 incidents from Redis, then filter to:
  //   - CI failures only (noise reduction — Sentry/security alerts add no context here)
  //   - Same branch (relevance — only failures on this branch matter)
  //   - Last 7 days (recency — older patterns are less actionable)
  //   - Maximum 5 (token budget — each adds ~100-200 tokens to the prompt)
  //
  // If Redis is unavailable or empty, falls back to stateless analysis (empty array).

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  const recentBranchIncidents = await getIncidents(100)
    .then((all) =>
      all
        .filter(
          (i) =>
            i.type === "ci_failure" &&
            i.branch === event.context.branch &&
            !i.isDemo &&
            i.timestamp >= cutoff,
        )
        .slice(0, 5),
    )
    .catch(() => []);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "history_context",
      runId,
      branch: event.context.branch,
      recentCount: recentBranchIncidents.length,
    }),
  );

  // ── 5. Analyze with Claude ─────────────────────────────────────────────────
  //
  // We call the Anthropic client directly (not analyzeEvent()) so we can
  // pass recentBranchIncidents to buildCiFailureUserPrompt().
  // analyzeEvent() is stateless by design — this agent adds the memory layer.

  const client = getAnthropicClient();
  const userPrompt = buildCiFailureUserPrompt(
    event,
    recentBranchIncidents,
    isDemo,
  );

  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 1024,
    system: CI_FAILURE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const analysis = parseAnalysisXml(rawText);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "analysis_complete",
      runId,
      severity: analysis.severity,
      isRecurrence: analysis.summary.toLowerCase().startsWith("recurrence"),
    }),
  );

  // ── 6. Branch-aware fan-out ───────────────────────────────────────────────

  const { branch, prNumber } = event.context;
  const isMainOrDev = branch === "main" || branch === "dev";
  const isDependabot = branch.startsWith("dependabot/");
  const createGithubIssue = isMainOrDev || isDependabot;
  const createPrComment = prNumber !== null && !createGithubIssue;

  const [prResult, issueResult, docResult] = await Promise.allSettled([
    createPrComment
      ? postPrComment(prNumber, analysis, "ci_failure")
      : Promise.resolve(null),
    createGithubIssue
      ? createIssue(
          `${isDemo ? "[Demo] " : ""}[CI] ${analysis.summary}`,
          analysis,
          isDemo ? ["ci", workflowName, "demo"] : ["ci", workflowName],
        )
      : Promise.resolve(null),
    generateAndCommitIncidentDoc(event, analysis),
  ]);

  const issueValue =
    issueResult.status === "fulfilled" && issueResult.value !== null
      ? issueResult.value
      : null;
  const issueUrl = issueValue?.url;
  const githubIssueNumber = issueUrl
    ? parseInt(issueUrl.split("/").pop() ?? "", 10) || undefined
    : undefined;
  // Only meaningful when createGithubIssue was true and the call rejected —
  // see IncidentRecord.githubIssueError for why this is tracked at all.
  const githubIssueError =
    issueResult.status === "rejected" ? String(issueResult.reason) : undefined;

  const incidentDocPath =
    docResult.status === "fulfilled" ? docResult.value.filePath : undefined;

  if (prResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "ci",
        step: "pr_comment",
        runId,
        error: String(prResult.reason),
      }),
    );
  }
  if (issueResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "ci",
        step: "issue",
        runId,
        error: String(issueResult.reason),
      }),
    );
  }
  if (docResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "ci",
        step: "incident_doc",
        runId,
        error: String(docResult.reason),
      }),
    );
  }

  await sendIncidentEmail({ event, analysis, incidentDocPath, issueUrl }).catch(
    (e: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          agent: "ci",
          step: "email",
          runId,
          error: String(e),
        }),
      );
    },
  );

  // ── 7. Write to Redis memory ──────────────────────────────────────────────

  await logIncident({
    type: "ci_failure",
    id: runId,
    summary: analysis.summary,
    rootCause: analysis.rootCause,
    severity: analysis.severity,
    labels: analysis.labels,
    service: event.service,
    timestamp: event.timestamp,
    issueUrl,
    githubIssueNumber,
    githubIssueError,
    incidentDocPath,
    commitSha: event.context.commitSha || undefined,
    branch: event.context.branch || undefined,
    isDemo: isDemo || undefined,
  });

  await markIncidentOpen(runId);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "complete",
      runId,
      commitSha: event.context.commitSha.slice(0, 7),
      issueUrl,
      incidentDocPath,
      githubIssueNumber,
      historyContextUsed: recentBranchIncidents.length,
      isDemo,
    }),
  );
}
