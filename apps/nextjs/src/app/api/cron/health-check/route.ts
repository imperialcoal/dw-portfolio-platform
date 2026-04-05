// Synthetic uptime monitoring — runs on a schedule via vercel.json cron.
// Uses the uptime sensor which derives all URLs from VERCEL_DOMAIN + APP_ENV.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { logIncident, markIncidentOpen } from "@dw/ai/memory";
import { runUptimeChecks } from "@dw/ai/sensors";
import { config } from "@dw/config";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${config.cron.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(
    JSON.stringify({
      level: "info",
      cron: "health-check",
      event: "triggered",
      appEnv: config.app.APP_ENV,
    }),
  );

  const results = await runUptimeChecks();

  // runUptimeChecks returns [] in local/test — nothing to do
  if (results.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `No uptime checks defined for APP_ENV=${config.app.APP_ENV}`,
    });
  }

  const failed = results.filter((r) => r.status === "down");
  const degraded = results.filter((r) => r.status === "degraded");

  // Hourly dedup bucket — one incident per URL per hour maximum
  const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60));

  await Promise.allSettled(
    failed.map(async (check) => {
      // Build a safe ID from the URL path, not the full URL
      const urlPath = check.url.replace(/^https?:\/\/[^/]+/, "") || "/";
      const safeId = urlPath
        .replace(/[^a-z0-9]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const incidentId = `uptime-${safeId || "root"}-${hourBucket}`;

      await logIncident({
        type: "uptime_failure",
        id: incidentId,
        service: check.name,
        timestamp: check.checkedAt,
        summary: `${check.name} is unreachable`,
        rootCause: check.error
          ? `Health check failed: ${check.error}`
          : `HTTP ${check.statusCode ?? "timeout"} — endpoint is not responding.`,
        // Use the critical flag from the check definition
        severity: check.critical ? "critical" : "high",
        labels: [
          "uptime",
          "availability",
          check.name.toLowerCase().replace(/\s+/g, "-"),
        ],
        commitSha: undefined,
        branch: undefined,
      });

      await markIncidentOpen(incidentId);
    }),
  );

  const summary = {
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
  };

  console.log(
    JSON.stringify({
      level: "info",
      cron: "health-check",
      event: "complete",
      ...summary,
    }),
  );

  return NextResponse.json(summary);
}
