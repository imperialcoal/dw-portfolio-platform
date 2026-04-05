// Runs after each deploy to snapshot the current P50/P95 response times
// as the new baseline. Subsequent comparisons use this to detect regressions.
// Call this from a Vercel deploy hook or manually trigger from the platform dashboard.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  computePercentile,
  getPerfBaseline,
  getRollingPerf,
  logIncident,
  markIncidentOpen,
  recordPerfSample,
  setPerfBaseline,
} from "@dw/ai/memory";
import { config } from "@dw/config";

export const runtime = "nodejs";
export const maxDuration = 30;

// Routes to track — these match the tRPC log format in Vercel logs
const TRACKED_ROUTES = ["/api/trpc/post.all", "/", "/api/trpc"];

// Regression threshold: alert if P95 increases more than 2× the baseline
const REGRESSION_MULTIPLIER = 2.0;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${config.cron.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: {
    route: string;
    p50Ms: number;
    p95Ms: number;
    samples: number;
    baselineP95: number | null;
    regression: boolean;
  }[] = [];

  for (const route of TRACKED_ROUTES) {
    const samples = await getRollingPerf(route, 50).catch(() => [] as number[]);
    if (samples.length < 5) continue; // not enough data

    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = computePercentile(sorted, 50);
    const p95 = computePercentile(sorted, 95);

    const existingBaseline = await getPerfBaseline(route).catch(() => null);
    const baselineP95 = existingBaseline?.p95Ms ?? null;

    const regression =
      baselineP95 !== null && p95 > baselineP95 * REGRESSION_MULTIPLIER;

    if (regression) {
      const incidentId = `perf-regression-${route.replace(/\//g, "-")}-${Math.floor(Date.now() / (1000 * 60 * 60 * 6))}`; // 6h dedup bucket

      await logIncident({
        type: "ci_failure", // Reuse closest category — no dedicated perf type needed
        id: incidentId,
        service: "nextjs",
        timestamp: new Date().toISOString(),
        summary: `Performance regression detected on ${route}`,
        rootCause: `P95 response time increased from ${baselineP95}ms to ${p95}ms — ${Math.round((p95 / baselineP95) * 100 - 100)}% above baseline.`,
        severity: p95 > baselineP95 * 3 ? "high" : "medium",
        labels: ["performance", "regression", route.replace(/\//g, "")],
      }).catch(() => undefined);

      await markIncidentOpen(incidentId).catch(() => undefined);
    }

    // Update baseline
    await setPerfBaseline({
      route,
      p50Ms: p50,
      p95Ms: p95,
      sampleCount: samples.length,
      capturedAt: new Date().toISOString(),
    }).catch(() => undefined);

    results.push({
      route,
      p50Ms: p50,
      p95Ms: p95,
      samples: samples.length,
      baselineP95,
      regression,
    });
  }

  return NextResponse.json({ ok: true, baselines: results });
}

// ─────────────────────────────────────────────
// Vercel log ingestion — POST from a log drain or manually
// In practice: parse Vercel structured logs for tRPC timing lines
// and write samples to Redis via a separate log drain endpoint.
// ─────────────────────────────────────────────

// apps/nextjs/src/app/api/platform/perf/ingest/route.ts
// Receives tRPC timing data extracted from Vercel logs.
// Body: { route: string; durationMs: number; deploymentId?: string }
// Called by a Vercel Log Drain webhook (or you can manually POST for testing).

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${config.cron.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { route, durationMs } = body as { route?: string; durationMs?: number };

  if (!route || typeof durationMs !== "number") {
    return NextResponse.json(
      { error: "route and durationMs required" },
      { status: 400 },
    );
  }

  await recordPerfSample(route, durationMs).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
