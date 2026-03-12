import { normalizeSentryWebhook } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import { isDuplicate, logEvent, logIncident } from "../memory/redis";

// Safely converts an unknown value to string without risking [object Object]
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

  // safeId instead of String() — avoids no-base-to-string when id is unknown
  const issueId = safeId(issue.id);
  const action = typeof payload.action === "string" ? payload.action : "";

  console.log(
    JSON.stringify({
      level: "info",
      agent: "sentry",
      event: "triggered",
      issueId,
      action,
    }),
  );

  // Only handle new issues
  if (action !== "created" && action !== "triggered") {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "sentry",
        event: "action_skip",
        action,
      }),
    );
    return;
  }

  // 1. Dedup
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

  // 2. Normalize
  const event = normalizeSentryWebhook(payload);

  // 3. Log raw event
  await logEvent(event);

  // 4. LLM analysis
  const analysis = await analyzeEvent(event);
  console.log(
    JSON.stringify({
      level: "info",
      agent: "sentry",
      event: "analyzed",
      issueId,
      severity: analysis.severity,
    }),
  );

  // 5. Fan out (parallel)
  // createIssue returns { number, url } — never null/undefined when fulfilled
  // generateAndCommitIncidentDoc returns IncidentDocResult — never null when fulfilled
  const [issueResult, docResult] = await Promise.allSettled([
    createIssue(`[Incident] ${analysis.summary}`, analysis, [
      "incident",
      "sentry",
      event.context.environment,
    ]),
    generateAndCommitIncidentDoc(event, analysis, event.context.issueUrl),
  ]);

  // issueResult.value is { number: number; url: string } when fulfilled — always has url
  const issueUrl: string | undefined =
    issueResult.status === "fulfilled" ? issueResult.value.url : undefined;

  // docResult.value is IncidentDocResult when fulfilled — always has filePath
  const incidentDocPath: string | undefined =
    docResult.status === "fulfilled" ? docResult.value.filePath : undefined;

  if (issueResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "sentry",
        step: "issue",
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
        error: String(docResult.reason),
      }),
    );
  }

  // 6. Email
  await sendIncidentEmail({ event, analysis, incidentDocPath, issueUrl }).catch(
    (e: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          agent: "sentry",
          step: "email",
          error: String(e),
        }),
      );
    },
  );

  // 7. Persist for dashboard
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
    incidentDocPath,
  });

  console.log(
    JSON.stringify({
      level: "info",
      agent: "sentry",
      event: "complete",
      issueId,
      issueUrl,
    }),
  );
}
