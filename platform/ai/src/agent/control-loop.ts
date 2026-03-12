// Central control loop — ties all agents together.
//
// Trigger modes:
//   1. Webhook (primary):  GitHub/Sentry POST → route.ts → runCiAgent / runSentryAgent directly
//   2. Scheduled (via Vercel cron): GET /api/cron/platform-agent → runControlLoop()
//   3. Manual (via CLI):   pnpm dw platform scan
//
// The control loop is for the periodic/scheduled path only.
// Webhook-triggered paths bypass it and call agents directly for lower latency.

import type { ControlLoopResult } from "@dw/contracts";

import { runSentryAgent } from "../analyzers/sentry-agent";
import { getEvents, getIncidents } from "../memory/redis";
import { fetchSentryIssues } from "../sensors/sentry";
import { getLastProductionDeploy } from "../sensors/vercel";

/**
 * Runs one full control loop cycle.
 *
 * Designed to be called from:
 * - A Vercel cron job (e.g., every 30 minutes)
 * - The CLI `pnpm dw platform scan`
 *
 * The loop:
 * 1. Polls Sentry for new unresolved issues not yet in memory
 * 2. Runs the Sentry agent on any new issues found
 * 3. Checks Vercel for the latest production deploy (for correlation)
 * 4. Returns a summary of what was processed
 */
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

  // 1. Fetch known incident IDs from memory to avoid re-processing
  const knownIncidents = await getIncidents(50).catch((e: unknown) => {
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

  // 3. Process any Sentry issues not already in memory
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

    // Construct a synthetic payload matching the webhook shape
    // so we can reuse the same agent entrypoint.
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

  // 4. Fetch latest production deploy for dashboard correlation
  const lastDeploy = await getLastProductionDeploy().catch((e: unknown) => {
    errors.push(`Failed to fetch Vercel deploy: ${String(e)}`);
    return null;
  });

  // 5. Summary log
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

/**
 * Lightweight health check — confirms agents can reach their dependencies.
 * Called by GET /api/platform/health or the CLI.
 */
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
