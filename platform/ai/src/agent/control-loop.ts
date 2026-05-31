// Central control loop — ties all agents together.
//
// Trigger modes:
//   1. Webhook (primary):  GitHub/Sentry POST → route.ts → agents directly
//   2. Scheduled (Vercel cron): GET /api/cron/platform-agent → runControlLoop()
//   3. Manual (CLI): pnpm dw platform scan
//
// The control loop handles two jobs:
//   A. Process new Sentry issues not yet in Redis memory
//   B. Auto-resolve "monitoring" incidents whose Sentry issue is no longer unresolved
//
// Job B fixes the "closed issue resurfacing" problem: when Sentry marks an issue
// resolved, the webhook sets the incident to "monitoring". The control loop then
// checks if the issue has been in "monitoring" long enough (>= MONITORING_TTL_HOURS)
// and if the issue no longer appears in Sentry's unresolved list — if both true,
// it transitions the incident to "resolved".

import type { ControlLoopResult } from "@dw/contracts";

import { runSentryAgent } from "../analyzers/sentry-agent";
import { getEvents, getIncidents, updateIncidentStatus } from "../memory/redis";
import { fetchSentryIssues } from "../sensors/sentry";
import { getLastProductionDeploy } from "../sensors/vercel";

// How long an incident stays in "monitoring" before we auto-resolve it
// if the Sentry issue is no longer showing as unresolved.
const MONITORING_TTL_HOURS = 24;

export async function runControlLoop(): Promise<ControlLoopResult> {
  const errors: string[] = [];
  let sentryIssuesScanned = 0;

  console.log(
    JSON.stringify({
      level: "info",
      agent: "control-loop",
      event: "started",
      timestamp: new Date().toISOString(),
    }),
  );

  // 1. Fetch known incidents from memory
  const knownIncidents = await getIncidents(100).catch((e: unknown) => {
    errors.push(`Failed to fetch known incidents: ${String(e)}`);
    return [];
  });

  const knownIds = new Set(knownIncidents.map((i) => i.id));

  // 2. Poll Sentry for recent unresolved issues
  const sentryIssues = await fetchSentryIssues(20).catch((e: unknown) => {
    errors.push(`Failed to fetch Sentry issues: ${String(e)}`);
    return [];
  });

  sentryIssuesScanned = sentryIssues.length;

  // Build set of currently unresolved Sentry issue IDs for the monitoring check below
  const unresolvedSentryIds = new Set(sentryIssues.map((i) => i.id));

  // 3. Process new Sentry issues not already in memory
  for (const issue of sentryIssues) {
    if (knownIds.has(issue.id)) continue;

    console.log(
      JSON.stringify({
        level: "info",
        agent: "control-loop",
        event: "new_sentry_issue",
        issueId: issue.id,
        title: issue.title,
      }),
    );

    const syntheticPayload: Record<string, unknown> = {
      action: "created",
      project_slug: issue.project.slug,
      data: {
        issue: {
          id: issue.id,
          title: issue.title,
          culprit: issue.culprit,
          permalink: issue.permalink,
          firstSeen: issue.firstSeen,
          userCount: issue.userCount,
          project: issue.project,
        },
      },
    };

    await runSentryAgent(syntheticPayload).catch((e: unknown) => {
      errors.push(`Sentry agent failed for issue ${issue.id}: ${String(e)}`);
    });
  }

  // 4. Auto-resolve "monitoring" incidents whose Sentry issue is no longer unresolved
  //
  // An incident is eligible for auto-resolution when ALL of the following are true:
  //   - status is "monitoring" (set by Sentry issue_resolved webhook)
  //   - type is "sentry_error" (only Sentry incidents go through monitoring)
  //   - updatedAt is older than MONITORING_TTL_HOURS (grace period to detect regressions)
  //   - the sentryIssueId is NOT in the current unresolved Sentry list
  //
  // This prevents the "monitoring" state from being permanent when Sentry
  // marks an issue resolved and no regression occurs within the grace period.
  const monitoringCutoff = Date.now() - MONITORING_TTL_HOURS * 60 * 60 * 1000;

  const monitoringIncidents = knownIncidents.filter(
    (i) =>
      i.status === "monitoring" &&
      i.type === "sentry_error" &&
      new Date(i.updatedAt).getTime() < monitoringCutoff,
  );

  for (const incident of monitoringIncidents) {
    // Only auto-resolve if Sentry confirms it's no longer unresolved
    if (
      incident.sentryIssueId &&
      unresolvedSentryIds.has(incident.sentryIssueId)
    ) {
      // Issue regressed — leave it in monitoring, the Sentry webhook will handle it
      continue;
    }

    await updateIncidentStatus(incident.id, "resolved", {
      resolvedBy: "manual",
      resolutionNote: `Auto-resolved after ${MONITORING_TTL_HOURS}h monitoring period — issue no longer appears in Sentry unresolved list`,
    }).catch((e: unknown) => {
      errors.push(
        `Failed to auto-resolve monitoring incident ${incident.id}: ${String(e)}`,
      );
    });

    console.log(
      JSON.stringify({
        level: "info",
        agent: "control-loop",
        event: "monitoring_auto_resolved",
        incidentId: incident.id,
        sentryIssueId: incident.sentryIssueId,
        monitoringHours: MONITORING_TTL_HOURS,
      }),
    );
  }

  // 5. Fetch latest production deploy for dashboard correlation
  const lastDeploy = await getLastProductionDeploy().catch((e: unknown) => {
    errors.push(`Failed to fetch Vercel deploy: ${String(e)}`);
    return null;
  });

  const incidentsInMemory = await getEvents(1)
    .then(() => knownIncidents.length)
    .catch(() => 0);

  const result: ControlLoopResult = {
    ranAt: new Date().toISOString(),
    sentryIssuesScanned,
    incidentsInMemory,
    lastDeployCommit: lastDeploy?.meta.githubCommitSha ?? null,
    errors,
  };

  console.log(
    JSON.stringify({
      level: "info",
      agent: "control-loop",
      event: "complete",
      ...result,
    }),
  );

  return result;
}

export async function checkAgentHealth(): Promise<{
  redis: boolean;
  sentry: boolean;
  vercel: boolean;
}> {
  const [redisOk, sentryOk, vercelOk] = await Promise.allSettled([
    getIncidents(1).then(() => true),
    fetchSentryIssues(1).then(() => true),
    getLastProductionDeploy().then(() => true),
  ]);

  return {
    redis: redisOk.status === "fulfilled" && redisOk.value,
    sentry: sentryOk.status === "fulfilled" && sentryOk.value,
    vercel: vercelOk.status === "fulfilled" && vercelOk.value,
  };
}
