// Sentry incident agent — runs in Node.js runtime via /api/process/sentry.
// Called by the QStash processing endpoint after webhook enqueue.
// Never called directly from Edge routes.

import { normalizeSentryWebhook, safeId } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import {
  findIncidentBySentryIssue,
  isDuplicate,
  logEvent,
  logIncident,
  markIncidentOpen,
  updateIncidentStatus,
} from "../memory/redis";

// ─────────────────────────────────────────────
// Action semantics
//
// created   → brand new issue, never seen before
// triggered → alert rule fired on existing issue
// regressed → issue was resolved but reoccurred
//
// For dedup purposes:
//   created/triggered → dedup by issue ID (skip if already processed)
//   regressed         → always process, even if we've seen this issue before,
//                       because a regression means the previous fix didn't hold.
//                       We reopen the existing incident rather than create a new one.
// ─────────────────────────────────────────────

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

  if (
    action !== "created" &&
    action !== "triggered" &&
    action !== "regressed"
  ) {
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

  // ── Regression handling ───────────────────────────────────────────────────
  // A regressed issue has been seen before. Instead of creating a duplicate,
  // reopen the existing incident and update its status back to "open".
  // This preserves the full history while correctly signalling the recurrence.
  if (action === "regressed") {
    const existing = await findIncidentBySentryIssue(issueId);
    if (existing) {
      await updateIncidentStatus(existing.id, "open", {
        resolutionNote: `Regressed — issue reoccurred after being resolved`,
      });
      console.log(
        JSON.stringify({
          level: "info",
          agent: "sentry",
          event: "regression_reopened",
          issueId,
          incidentId: existing.id,
          previousStatus: existing.status,
        }),
      );

      // Still send an email — the developer needs to know the fix didn't hold
      const event = normalizeSentryWebhook(payload);
      const analysis = await analyzeEvent(event);
      await sendIncidentEmail({
        event,
        analysis,
        incidentDocPath: existing.incidentDocPath,
        issueUrl: existing.issueUrl,
      }).catch((e: unknown) => {
        console.error(
          JSON.stringify({
            level: "error",
            agent: "sentry",
            step: "email",
            issueId,
            error: String(e),
          }),
        );
      });

      return;
    }

    // No existing incident found for this regression — fall through and
    // treat it as a new incident (the original may have expired from Redis)
    console.log(
      JSON.stringify({
        level: "info",
        agent: "sentry",
        event: "regression_no_existing_incident",
        issueId,
        message:
          "No prior incident found — treating regression as new incident",
      }),
    );
  }

  // ── Dedup for created/triggered ───────────────────────────────────────────
  if (action !== "regressed" && (await isDuplicate("sentry_error", issueId))) {
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
      action,
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
    sentryIssueId: issueId,
    sentryIssueUrl: event.context.issueUrl,
  });

  await markIncidentOpen(issueId);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "sentry",
      event: "complete",
      issueId,
      action,
      issueUrl,
      incidentDocPath,
      githubIssueNumber,
    }),
  );
}
