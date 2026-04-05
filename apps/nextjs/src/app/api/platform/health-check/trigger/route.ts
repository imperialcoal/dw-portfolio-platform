// Manual trigger for the uptime health check — called from the platform dashboard.
// Uses requireAdmin() for auth (same as all other /api/platform/* routes).
// Internally calls the same runUptimeChecks() logic as the cron job.

import { NextResponse } from "next/server";

import { logIncident, markIncidentOpen } from "@dw/ai/memory";
import { runUptimeChecks } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";

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
    }),
  );

  const results = await runUptimeChecks();
  const failed = results.filter((r) => r.status === "down");
  const degraded = results.filter((r) => r.status === "degraded");

  const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60));

  await Promise.allSettled(
    failed.map(async (check) => {
      const safeUrl = check.url.replace(/[^a-z0-9]/gi, "-");
      const incidentId = `uptime-${safeUrl}-${hourBucket}`;

      await logIncident({
        type: "uptime_failure",
        id: incidentId,
        service: check.name,
        timestamp: check.checkedAt,
        summary: `${check.name} is unreachable`,
        rootCause: check.error
          ? `Health check failed: ${check.error}`
          : `HTTP ${check.statusCode ?? "timeout"} — endpoint is not responding.`,
        severity: check.url.includes("dw-portfolio.dev") ? "critical" : "high",
        labels: ["uptime", "availability", safeUrl],
        commitSha: undefined,
        branch: undefined,
      });

      await markIncidentOpen(incidentId);
    }),
  );

  return NextResponse.json({
    ok: true,
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
