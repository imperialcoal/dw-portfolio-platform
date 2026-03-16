// CI failure agent — runs in Node.js runtime via /api/process/ci.
// Called by the QStash processing endpoint after webhook enqueue.
// Never called directly from Edge routes.

import { normalizeGitHubWorkflowRun } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue, postPrComment } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import { isDuplicate, logEvent, logIncident } from "../memory/redis";
import { fetchCiJobDetails } from "../sensors/github-ci";

function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "";
}

/**
 * Analyzes a CI workflow_run failure and fans out outputs:
 * - PR comment (if the failure was on a PR)
 * - GitHub Issue (if the failure was on a protected branch with no PR)
 * - Incident doc committed to docs/incidents/
 * - Email notification via Resend
 * - Incident record persisted to Redis for dashboard
 *
 * Idempotent — deduplicates by runId with a 24h TTL.
 * QStash retries on non-200 responses from the calling route.
 */
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

  console.log(
    JSON.stringify({ level: "info", agent: "ci", event: "started", runId }),
  );

  // 1. Dedup — prevents re-analyzing the same run
  if (await isDuplicate("ci_failure", runId)) {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "ci",
        event: "duplicate_skip",
        runId,
      }),
    );
    return;
  }

  // 2. Fetch job details from GitHub API (structured step-level failure info)
  const jobLogs = await fetchCiJobDetails(repoFullName, runId);

  // 3. Normalize raw webhook payload → typed CiFailureEvent
  const event = normalizeGitHubWorkflowRun(payload, jobLogs);

  // 4. Persist raw event to Redis
  await logEvent(event);

  // 5. LLM analysis — the core of the agent
  const analysis = await analyzeEvent(event);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "analyzed",
      runId,
      severity: analysis.severity,
      summary: analysis.summary,
    }),
  );

  // 6. Fan out (parallel, non-blocking individually)
  const prNumber = event.context.prNumber;
  const isProtectedBranch = ["main", "dev"].includes(event.context.branch);

  const [prResult, issueResult, docResult] = await Promise.allSettled([
    // PR comment — when failure was triggered by a PR
    prNumber !== null
      ? postPrComment(prNumber, analysis, "ci_failure")
      : Promise.resolve(null),

    // GitHub Issue — when failure was a direct push to protected branch
    isProtectedBranch && prNumber === null
      ? createIssue(`[CI] ${analysis.summary}`, analysis, [
          "ci",
          event.context.workflow,
        ])
      : Promise.resolve(null),

    // Incident doc committed to docs/incidents/
    generateAndCommitIncidentDoc(event, analysis),
  ]);

  const issueUrl: string | undefined =
    issueResult.status === "fulfilled" && issueResult.value !== null
      ? issueResult.value.url
      : undefined;

  const incidentDocPath: string | undefined =
    docResult.status === "fulfilled" ? docResult.value.filePath : undefined;

  // Log any fan-out failures — non-fatal, agent continues
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

  // 7. Email notification
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

  // 8. Persist incident to Redis for dashboard
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
    incidentDocPath,
  });

  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "complete",
      runId,
      issueUrl,
      incidentDocPath,
    }),
  );
}
