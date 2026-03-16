// Sentry incident agent — runs in Node.js runtime via /api/process/sentry.
// Called by the QStash processing endpoint after webhook enqueue.
// Never called directly from Edge routes.

import { normalizeSentryWebhook } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import { isDuplicate, logEvent, logIncident } from "../memory/redis";

function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "";
}

/**
 * Analyzes a Sentry incident and fans out outputs:
 * - GitHub Issue created with severity label
 * - Incident doc committed to docs/incidents/
 * - Email notification via Resend
 * - Incident record persisted to Redis for dashboard
 *
 * Only processes "created" and "triggered" actions — ignores resolved,
 * assigned, and other lifecycle events.
 *
 * Idempotent — deduplicates by issueId with a 7d TTL.
 */
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

  // Only handle new issues — ignore resolved, assigned, etc.
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

  // 1. Dedup — prevents re-analyzing the same issue
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

  // 2. Normalize raw webhook payload → typed SentryErrorEvent
  const event = normalizeSentryWebhook(payload);

  // 3. Persist raw event to Redis
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
      summary: analysis.summary,
    }),
  );

  // 5. Fan out (parallel)
  const [issueResult, docResult] = await Promise.allSettled([
    createIssue(`[Incident] ${analysis.summary}`, analysis, [
      "incident",
      "sentry",
      event.context.environment,
    ]),
    generateAndCommitIncidentDoc(event, analysis, event.context.issueUrl),
  ]);

  const issueUrl: string | undefined =
    issueResult.status === "fulfilled" ? issueResult.value.url : undefined;

  const incidentDocPath: string | undefined =
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

  // 6. Email notification
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

  // 7. Persist incident to Redis for dashboard
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
      incidentDocPath,
    }),
  );
}
