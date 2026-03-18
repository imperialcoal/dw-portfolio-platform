// Sentry incident agent — runs in Node.js runtime via /api/process/sentry.
// Called by the QStash processing endpoint after webhook enqueue.
// Never called directly from Edge routes.

import { normalizeSentryWebhook } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import {
  isDuplicate,
  logEvent,
  logIncident,
  markIncidentOpen,
} from "../memory/redis";

function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "";
}

export async function runSentryAgent(
  payload: Record<string, unknown>,
): Promise<void> {
  const data =
    payload.data !== null && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};
  const issueRaw = data.issue ?? payload.issue;
  const issue =
    issueRaw !== null && typeof issueRaw === "object"
      ? (issueRaw as Record<string, unknown>)
      : {};

  const issueId = safeId(issue.id);
  const action = typeof payload.action === "string" ? payload.action : "";

  console.log(
    JSON.stringify({
      level: "info",
      agent: "sentry",
      event: "started",
      issueId,
      action,
    }),
  );

  if (action !== "created" && action !== "triggered") {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "sentry",
        event: "action_skip",
        issueId,
        action,
      }),
    );
    return;
  }

  if (await isDuplicate("sentry_error", issueId)) {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "sentry",
        event: "duplicate_skip",
        issueId,
      }),
    );
    return;
  }

  const event = normalizeSentryWebhook(payload);
  await logEvent(event);

  const analysis = await analyzeEvent(event);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "sentry",
      event: "analyzed",
      issueId,
      severity: analysis.severity,
      summary: analysis.summary,
    }),
  );

  const [issueResult, docResult] = await Promise.allSettled([
    createIssue(`[Incident] ${analysis.summary}`, analysis, [
      "incident",
      "sentry",
      event.context.environment,
    ]),
    generateAndCommitIncidentDoc(event, analysis, event.context.issueUrl),
  ]);

  const issueUrl =
    issueResult.status === "fulfilled" ? issueResult.value.url : undefined;
  const githubIssueNumber = issueUrl
    ? parseInt(issueUrl.split("/").pop() ?? "", 10) || undefined
    : undefined;

  const incidentDocPath =
    docResult.status === "fulfilled" ? docResult.value.filePath : undefined;

  if (issueResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "sentry",
        step: "issue",
        issueId,
        error: String(issueResult.reason),
      }),
    );
  }
  if (docResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "sentry",
        step: "incident_doc",
        issueId,
        error: String(docResult.reason),
      }),
    );
  }

  await sendIncidentEmail({ event, analysis, incidentDocPath, issueUrl }).catch(
    (e: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          agent: "sentry",
          step: "email",
          issueId,
          error: String(e),
        }),
      );
    },
  );

  await logIncident({
    type: "sentry_error",
    id: issueId,
    summary: analysis.summary,
    rootCause: analysis.rootCause,
    severity: analysis.severity,
    labels: analysis.labels,
    service: event.service,
    timestamp: event.timestamp,
    issueUrl,
    githubIssueNumber,
    incidentDocPath,
    // Store Sentry issue ID for resolution webhook matching
    sentryIssueId: issueId,
  });

  await markIncidentOpen(issueId);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "sentry",
      event: "complete",
      issueId,
      issueUrl,
      incidentDocPath,
      githubIssueNumber,
    }),
  );
}
