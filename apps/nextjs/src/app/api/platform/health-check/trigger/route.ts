// Manual trigger for the uptime health check — called from the platform dashboard.
// Uses the same uptime sensor as the cron.

import { NextResponse } from "next/server";

import { logIncident, markIncidentOpen } from "@dw/ai/memory";
import { runUptimeChecks } from "@dw/ai/sensors";
import { config } from "@dw/config";

import { requireAdmin } from "~/auth/require-admin";
import { env } from "~/env";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  console.log(
    JSON.stringify({
      level: "info",
      route: "health-check/trigger",
      event: "triggered",
      source: "manual",
      appEnv: config.app.APP_ENV,
    }),
  );

  const results = await runUptimeChecks();

  if (results.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `No uptime checks defined for APP_ENV=${config.app.APP_ENV}`,
    });
  }

  const failed = results.filter((r) => r.status === "down");
  const degraded = results.filter((r) => r.status === "degraded");
  const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60));

  await Promise.allSettled(
    failed.map(async (check) => {
      const urlPath = check.url.replace(/^https?:\/\/[^/]+/, "") || "/";
      const safeId = urlPath
        .replace(/[^a-z0-9]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const incidentId = `uptime-${safeId || "root"}-${hourBucket}`;

      const vercelProjectId = env.VERCEL_PROJECT_ID ?? "";
      const vercelTeamId = env.VERCEL_TEAM_ID ?? "";
      const vercelLogsUrl = vercelProjectId
        ? `https://vercel.com/${vercelTeamId ? `${vercelTeamId}/` : ""}${vercelProjectId}/logs`
        : undefined;

      await logIncident({
        type: "uptime_failure",
        id: incidentId,
        service: check.name,
        timestamp: check.checkedAt,
        summary: `${check.name} is unreachable`,
        rootCause: check.error
          ? `Health check failed: ${check.error}`
          : `HTTP ${check.statusCode ?? "timeout"} — endpoint is not responding.`,
        severity: check.critical ? "critical" : "high",
        labels: [
          "uptime",
          "availability",
          check.name.toLowerCase().replace(/\s+/g, "-"),
        ],
        issueUrl: vercelLogsUrl,
        commitSha: undefined,
        branch: undefined,
      });

      await markIncidentOpen(incidentId);
    }),
  );

  return NextResponse.json({
    ok: true,
    appEnv: config.app.APP_ENV,
    checked: results.length,
    up: results.filter((r) => r.status === "up").length,
    degraded: degraded.length,
    down: failed.length,
    results: results.map((r) => ({
      name: r.name,
      status: r.status,
      statusCode: r.statusCode,
      responseTimeMs: r.responseTimeMs,
    })),
  });
}
