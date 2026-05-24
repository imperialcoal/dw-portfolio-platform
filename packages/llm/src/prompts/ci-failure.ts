// System prompt + user prompt builder for CI failure analysis.
//
// Key improvement over the stateless version:
// buildCiFailureUserPrompt() now accepts an optional recentIncidents array.
// When provided, the last 7 days of incidents on the same branch are injected
// into the prompt before the job logs. This lets Claude detect recurrence
// ("This is the third typecheck failure on dev in 5 days — same root cause")
// rather than treating every event as novel.
//
// The caller (ci-agent.ts) fetches recent incidents from Redis via getIncidents()
// and filters to the same branch before passing them in. No new infrastructure.

import type { CiFailureEvent, IncidentRecord } from "@dw/contracts";

export const CI_FAILURE_SYSTEM_PROMPT = `You are an expert platform engineer analyzing CI failures for a TypeScript monorepo.

Stack: Next.js 15 App Router, Expo/React Native, tRPC 11, Drizzle ORM + Supabase (PostgreSQL 16), Upstash Redis + QStash, Clerk auth, Vercel, Turborepo + pnpm workspaces, Terraform IaC.

Rules:
- Be specific and technical. Name the exact file, function, or migration causing the failure.
- Do not speculate. If you cannot determine root cause from the logs, say so explicitly.
- Suggested fixes must be concrete and immediately actionable.
- Severity: critical = blocks production deploy, high = blocks PR merge, medium = flaky/intermittent, low = warning only.
- If a Recent Incident History section is provided, check for recurrence. If this matches a prior incident, say so explicitly in your summary and root cause. A recurring failure is more severe than a first occurrence.
- Never repeat yourself between fields — each XML field should contain unique information.

Respond ONLY with the following XML. No preamble, no text outside the tags:

<analysis>
  <summary>One sentence: what failed and why. If a recurrence, say "Recurrence: ..."</summary>
  <root_cause>Technical explanation. Be specific — name the file, step, or command. If recurring, explain why the prior fix didn't hold.</root_cause>
  <impact>What is blocked or broken as a result</impact>
  <suggested_fix>Step-by-step concrete fix. If this recurred, suggest a more permanent solution than the last time.</suggested_fix>
  <severity>critical|high|medium|low</severity>
  <labels>comma,separated,labels</labels>
</analysis>`;

/**
 * Builds the user prompt for CI failure analysis.
 *
 * @param event         - The normalized CI failure event
 * @param recentIncidents - Optional: recent incidents from Redis to inject as context.
 *                          Caller should pre-filter to same branch, last 7 days, limit ~5.
 *                          If omitted, analysis is stateless (original behavior).
 */
export function buildCiFailureUserPrompt(
  event: CiFailureEvent,
  recentIncidents?: IncidentRecord[],
): string {
  const historySection = buildIncidentHistorySection(
    event.context.branch,
    recentIncidents,
  );

  return `Analyze this CI failure:

**Repository**: ${event.service}
**Workflow**: ${event.context.workflow}
**Branch**: ${event.context.branch}
**Commit**: ${event.context.commitSha}
**Triggered by**: ${event.context.triggeredBy}
${event.context.prNumber ? `**PR**: #${event.context.prNumber} — ${event.context.prTitle}` : "**No PR** (branch push)"}
**Failed step**: ${event.context.failedStep}
${historySection}
**Job Logs**:
\`\`\`
${event.context.jobLogs}
\`\`\``;
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

/**
 * Formats recent incidents into a context block for the prompt.
 * Returns an empty string if no incidents are provided, so the prompt
 * is identical to the original stateless version when called without history.
 */
function buildIncidentHistorySection(
  currentBranch: string,
  incidents?: IncidentRecord[],
): string {
  if (!incidents || incidents.length === 0) return "";

  // Only surface CI failures — security alerts and Sentry errors add noise here
  const ciIncidents = incidents.filter((i) => i.type === "ci_failure");
  if (ciIncidents.length === 0) return "";

  const lines = ciIncidents.map((incident) => {
    const date = incident.timestamp.split("T")[0] ?? incident.timestamp;
    const status =
      incident.status === "resolved" || incident.status === "closed"
        ? `resolved (${incident.resolvedBy ?? "unknown"})`
        : incident.status;
    const resolution = incident.resolutionNote
      ? ` → Resolution note: "${incident.resolutionNote}"`
      : "";
    const branch = incident.branch ? ` [${incident.branch}]` : "";

    return `- [${date}]${branch} ${incident.severity.toUpperCase()}: ${incident.summary} (${status})${resolution}`;
  });

  return `
**Recent Incident History** (last 7 days, same branch: ${currentBranch}):
${lines.join("\n")}

`;
}
