// Security alert agent — runs in Node.js runtime via /api/process/security.
// Triggered by GitHub repository_vulnerability_alert webhook events.
// Auto-resolves when GitHub fires dismissed/auto_dismissed/fixed actions.

import { normalizeSecurityAlert } from "@dw/contracts";
import { analyzeEvent } from "@dw/llm";
import { sendIncidentEmail } from "@dw/messaging";

import { createIssue } from "../actions/github";
import { generateAndCommitIncidentDoc } from "../actions/incident-doc";
import {
  findIncidentBySecurityAlert,
  isDuplicate,
  logEvent,
  logIncident,
  markIncidentOpen,
  updateIncidentStatus,
} from "../memory/redis";

function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "";
}

/**
 * Analyzes a Dependabot security alert and fans out outputs:
 * - GitHub Issue with CVE/GHSA details
 * - Incident doc committed to docs/incidents/
 * - Email notification
 * - Incident record in Redis with security_alert type
 *
 * Auto-resolves when GitHub fires dismissed/auto_dismissed/fixed actions.
 * Deduplicates new alerts by alert number with 7d TTL.
 */
export async function runSecurityAgent(
  payload: Record<string, unknown>,
): Promise<void> {
  const alert =
    payload.alert !== null && typeof payload.alert === "object"
      ? (payload.alert as Record<string, unknown>)
      : {};

  const alertId = safeId(alert.number ?? alert.id);
  const action = typeof payload.action === "string" ? payload.action : "";

  console.log(
    JSON.stringify({
      level: "info",
      agent: "security",
      event: "started",
      alertId,
      action,
    }),
  );

  // ── Auto-resolution: dismissed / fixed ────────────────────────────────────
  if (
    action === "dismissed" ||
    action === "auto_dismissed" ||
    action === "fixed"
  ) {
    const incident = await findIncidentBySecurityAlert(alertId);
    if (incident) {
      await updateIncidentStatus(incident.id, "resolved", {
        resolvedBy: "github_issue_closed",
        resolutionNote: `Dependabot alert #${alertId} was ${action}`,
      });
      console.log(
        JSON.stringify({
          level: "info",
          agent: "security",
          event: "auto_resolved",
          alertId,
          action,
          incidentId: incident.id,
        }),
      );
    } else {
      console.log(
        JSON.stringify({
          level: "info",
          agent: "security",
          event: "no_matching_incident_for_resolution",
          alertId,
          action,
        }),
      );
    }
    return;
  }

  // ── Only process new alerts ───────────────────────────────────────────────
  if (action !== "created") {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "security",
        event: "action_skip",
        alertId,
        action,
      }),
    );
    return;
  }

  // ── Dedup by alert number (7d TTL, reuses sentry_error bucket) ────────────
  if (await isDuplicate("sentry_error", `security:${alertId}`)) {
    console.log(
      JSON.stringify({
        level: "info",
        agent: "security",
        event: "duplicate_skip",
        alertId,
      }),
    );
    return;
  }

  const event = normalizeSecurityAlert(payload);
  await logEvent(event);

  const analysis = await analyzeEvent(event);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "security",
      event: "analyzed",
      alertId,
      severity: analysis.severity,
      summary: analysis.summary,
    }),
  );

  const pkg = event.context.packageName;
  const identifier = event.context.cveId ?? event.context.ghsaId;

  const [issueResult, docResult] = await Promise.allSettled([
    createIssue(`[Security] ${pkg} — ${identifier}`, analysis, [
      "security",
      "dependabot",
      event.context.ecosystem,
    ]),
    generateAndCommitIncidentDoc(event, analysis, event.context.alertUrl),
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
        agent: "security",
        step: "issue",
        alertId,
        error: String(issueResult.reason),
      }),
    );
  }
  if (docResult.status === "rejected") {
    console.error(
      JSON.stringify({
        level: "error",
        agent: "security",
        step: "incident_doc",
        alertId,
        error: String(docResult.reason),
      }),
    );
  }

  await sendIncidentEmail({ event, analysis, incidentDocPath, issueUrl }).catch(
    (e: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          agent: "security",
          step: "email",
          alertId,
          error: String(e),
        }),
      );
    },
  );

  // Store with sentryIssueId = alertId so findIncidentBySecurityAlert can match it
  await logIncident({
    type: "security_alert",
    id: `security:${alertId}`,
    summary: analysis.summary,
    rootCause: analysis.rootCause,
    severity: analysis.severity,
    labels: analysis.labels,
    service: event.service,
    timestamp: event.timestamp,
    issueUrl,
    githubIssueNumber,
    incidentDocPath,
    sentryIssueId: alertId,
  });

  await markIncidentOpen(`security:${alertId}`);

  console.log(
    JSON.stringify({
      level: "info",
      agent: "security",
      event: "complete",
      alertId,
      issueUrl,
      incidentDocPath,
    }),
  );
}
