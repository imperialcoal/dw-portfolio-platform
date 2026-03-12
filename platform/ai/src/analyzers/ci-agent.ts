import { normalizeGitHubWorkflowRun } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue, postPrComment } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import { isDuplicate, logEvent, logIncident } from "../memory/redis";
import { fetchCiJobDetails } from "../sensors/github-ci";

// Safely converts an unknown value to string without risking [object Object]
function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "";
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

  console.log(
    JSON.stringify({ level: "info", agent: "ci", event: "triggered", runId }),
  );

  // 1. Dedup
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

  // 2. Fetch job details
  const jobLogs = await fetchCiJobDetails(repoFullName, runId);

  // 3. Normalize
  const event = normalizeGitHubWorkflowRun(payload, jobLogs);

  // 4. Log raw event
  await logEvent(event);

  // 5. LLM analysis
  const analysis = await analyzeEvent(event);
  console.log(
    JSON.stringify({
      level: "info",
      agent: "ci",
      event: "analyzed",
      runId,
      severity: analysis.severity,
    }),
  );

  // 6. Fan out (parallel, non-blocking)
  const prNumber = event.context.prNumber;
  const isProtectedBranch = ["main", "dev"].includes(event.context.branch);

  // TypeScript infers the tuple types from Promise.allSettled:
  // prResult:    PromiseSettledResult<void | null>
  // issueResult: PromiseSettledResult<{ number: number; url: string } | null>
  // docResult:   PromiseSettledResult<IncidentDocResult>
  //
  // When status === "fulfilled", .value is the resolved type.
  // For issueResult that's { number: number; url: string } | null — never
  // an arbitrary object, so typeof/in guards are unnecessary and trigger
  // no-unnecessary-condition. Access .url directly after the null check.
  const [prResult, issueResult, docResult] = await Promise.allSettled([
    prNumber !== null
      ? postPrComment(prNumber, analysis, "ci_failure")
      : Promise.resolve(null),

    isProtectedBranch && prNumber === null
      ? createIssue(`[CI] ${analysis.summary}`, analysis, [
          "ci",
          event.context.workflow,
        ])
      : Promise.resolve(null),

    generateAndCommitIncidentDoc(event, analysis),
  ]);

  // issueResult.value is { number: number; url: string } | null
  // — null when we passed Promise.resolve(null) (no-issue path)
  const issueUrl: string | undefined =
    issueResult.status === "fulfilled" && issueResult.value !== null
      ? issueResult.value.url
      : undefined;

  // docResult.value is IncidentDocResult — always has filePath when fulfilled
  const incidentDocPath: string | undefined =
    docResult.status === "fulfilled" ? docResult.value.filePath : undefined;

  if (prResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "ci",
        step: "pr_comment",
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
        error: String(docResult.reason),
      }),
    );
  }

  // 7. Email
  await sendIncidentEmail({ event, analysis, incidentDocPath, issueUrl }).catch(
    (e: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          agent: "ci",
          step: "email",
          error: String(e),
        }),
      );
    },
  );

  // 8. Persist for dashboard
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
