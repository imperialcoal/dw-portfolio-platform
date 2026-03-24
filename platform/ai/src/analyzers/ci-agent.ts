import { normalizeGitHubWorkflowRun, safeId } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue, postPrComment } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import {
  isDuplicate,
  logEvent,
  logIncident,
  markIncidentOpen,
} from "../memory/redis";
import { fetchCiJobDetails } from "../sensors/github-ci";

/**
 * Returns true if this branch should get a GitHub Issue created on failure.
 * Protected branches (main, dev) always get issues.
 * Dependabot branches get issues so resolution tracking works — closing the
 * issue marks the incident resolved in the dashboard.
 */
function shouldCreateIssue(branch: string, prNumber: number | null): boolean {
  if (prNumber !== null) return false; // PR comment path handles this case
  if (["main", "dev"].includes(branch)) return true;
  if (branch.startsWith("dependabot/")) return true;
  return false;
}

export async function runCiAgent(
  payload: Record<string, unknown>,
): Promise<void> {
  const workflowRun =
    payload.workflow_run !== null && typeof payload.workflow_run === "object"
      ? (payload.workflow_run as Record<string, unknown>)
      : {};

  const runId = safeId(workflowRun.id);

  const repository =
    payload.repository !== null && typeof payload.repository === "object"
      ? (payload.repository as Record<string, unknown>)
      : {};
  const repoFullName =
    typeof repository.full_name === "string" ? repository.full_name : "";

  const headCommit =
    workflowRun.head_commit !== null &&
    typeof workflowRun.head_commit === "object"
      ? (workflowRun.head_commit as Record<string, unknown>)
      : {};
  const commitSha = safeId(workflowRun.head_sha ?? headCommit.id);
  const branch = safeId(workflowRun.head_branch);
  const workflowName = safeId(workflowRun.name ?? workflowRun.workflow_id);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "started",
      runId,
      commitSha: commitSha.slice(0, 7),
      branch,
    }),
  );

  // ── Layer 1: Dedup by run ID ──────────────────────────────────────────────
  if (await isDuplicate("ci_failure", runId)) {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "ci",
        event: "duplicate_skip",
        reason: "run_id",
        runId,
      }),
    );
    return;
  }

  // ── Layer 2: Dedup by commit SHA + workflow + branch ──────────────────────
  // Prevents the same broken commit from being analyzed multiple times
  // even if it triggers multiple CI runs (e.g. incident doc commits).
  if (commitSha) {
    const commitDedupKey = `ci:commit:${commitSha.slice(0, 12)}:${workflowName}:${branch}`;
    if (await isDuplicate("ci_failure", commitDedupKey)) {
      console.log(
        JSON.stringify({
          level: "info",
          agent: "ci",
          event: "duplicate_skip",
          reason: "commit_sha",
          commitSha: commitSha.slice(0, 7),
          runId,
        }),
      );
      return;
    }
  }

  const jobLogs = await fetchCiJobDetails(repoFullName, runId);
  const event = normalizeGitHubWorkflowRun(payload, jobLogs);
  await logEvent(event);

  const analysis = await analyzeEvent(event);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "analyzed",
      runId,
      commitSha: commitSha.slice(0, 7),
      severity: analysis.severity,
      summary: analysis.summary,
    }),
  );

  const prNumber = event.context.prNumber;
  const createGithubIssue = shouldCreateIssue(event.context.branch, prNumber);

  const [prResult, issueResult, docResult] = await Promise.allSettled([
    prNumber !== null
      ? postPrComment(prNumber, analysis, "ci_failure")
      : Promise.resolve(null),
    createGithubIssue
      ? createIssue(`[CI] ${analysis.summary}`, analysis, [
          "ci",
          event.context.workflow,
        ])
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
    incidentDocPath,
    commitSha: commitSha || undefined,
    branch: event.context.branch || undefined,
  });

  await markIncidentOpen(runId);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "complete",
      runId,
      commitSha: commitSha.slice(0, 7),
      issueUrl,
      incidentDocPath,
      githubIssueNumber,
    }),
  );
}
