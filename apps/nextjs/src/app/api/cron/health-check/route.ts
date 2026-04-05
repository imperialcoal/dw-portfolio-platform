// Synthetic uptime monitoring — runs on a schedule, creates incidents on failure.
// Vercel Hobby: free cron runs up to 1/day on hobby, 2/day on Pro.
// We schedule this at a pace safe for all tiers.
//
// Schedule: every 30 minutes (via vercel.json — adjust to daily for Hobby tier)
// Redis cost per run: ~3 reads + 3 writes = negligible on pay-as-you-go Upstash.

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
    JSON.stringify({ level: "info", cron: "health-check", event: "triggered" }),
  );

  const results = await runUptimeChecks();
  const failed = results.filter((r) => r.status === "down");
  const degraded = results.filter((r) => r.status === "degraded");

  // Create incidents for any failed checks
  // Use a time-bucketed ID to prevent duplicate incidents within the same hour
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

  const summary = {
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

  return NextResponse.json({ ok: true, ...summary });
}
