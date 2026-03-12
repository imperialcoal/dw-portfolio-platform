import Link from "next/link";

import type { IncidentRecord } from "@dw/contracts";
import { getIncidents } from "@dw/ai/memory";

// ─────────────────────────────────────────────
// Pattern analysis (pure TS — no LLM call needed)
// ─────────────────────────────────────────────

function analyzePatterns(incidents: IncidentRecord[]) {
  const labelCounts: Record<string, number> = {};
  for (const incident of incidents) {
    for (const label of incident.labels) {
      labelCounts[label] = (labelCounts[label] ?? 0) + 1;
    }
  }
  const topLabels = Object.entries(labelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const serviceCounts: Record<string, number> = {};
  for (const incident of incidents) {
    serviceCounts[incident.service] =
      (serviceCounts[incident.service] ?? 0) + 1;
  }
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const severityDist = {
    critical: incidents.filter((i) => i.severity === "critical").length,
    high: incidents.filter((i) => i.severity === "high").length,
    medium: incidents.filter((i) => i.severity === "medium").length,
    low: incidents.filter((i) => i.severity === "low").length,
  };

  const ciCount = incidents.filter((i) => i.type === "ci_failure").length;
  const sentryCount = incidents.filter((i) => i.type === "sentry_error").length;

  const now = Date.now();
  const week1 = incidents.filter(
    (i) => now - new Date(i.timestamp).getTime() < 7 * 86400_000,
  ).length;
  const week2 = incidents.filter((i) => {
    const age = now - new Date(i.timestamp).getTime();
    return age >= 7 * 86400_000 && age < 14 * 86400_000;
  }).length;

  return {
    topLabels,
    topServices,
    severityDist,
    ciCount,
    sentryCount,
    week1,
    week2,
  };
}

interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

function generateRecommendations(
  incidents: IncidentRecord[],
  patterns: ReturnType<typeof analyzePatterns>,
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (patterns.topLabels.some(([l]) => l === "migration" || l === "database")) {
    recs.push({
      title: "Add migration safety checks to CI",
      description:
        "Multiple incidents tagged with database/migration. Consider adding a Drizzle migration dry-run step that checks for destructive operations before applying.",
      priority: "high",
    });
  }

  if (
    patterns.topLabels.some(([l]) => l === "null-check" || l === "undefined")
  ) {
    recs.push({
      title: "Enable stricter TypeScript null checks",
      description:
        "Several null/undefined errors detected. Ensure noUncheckedIndexedAccess is enabled in tsconfig. Consider adding Zod validation at API boundaries.",
      priority: "high",
    });
  }

  if (patterns.ciCount > patterns.sentryCount * 2) {
    recs.push({
      title: "Improve CI stability",
      description: `CI failures (${patterns.ciCount}) significantly outnumber runtime errors (${patterns.sentryCount}). Review flaky tests and consider adding retry logic to intermittent steps.`,
      priority: "medium",
    });
  }

  if (patterns.week1 > patterns.week2 + 2) {
    recs.push({
      title: "Incident volume trending up",
      description: `Last 7 days: ${patterns.week1} incidents vs ${patterns.week2} the week before. Review recent changes and consider a stability sprint.`,
      priority: "high",
    });
  }

  if (patterns.severityDist.critical > 0) {
    recs.push({
      title: "Review critical incident resolutions",
      description: `${patterns.severityDist.critical} critical incidents recorded. Verify each has a corresponding fix merged. Check docs/incidents/ for resolution status.`,
      priority: "high",
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: "System looks healthy",
      description:
        "No urgent patterns detected from recent incidents. Keep monitoring.",
      priority: "low",
    });
  }

  return recs;
}

const PRIORITY_STYLES = {
  high: "border-red-500/20 bg-red-500/5 text-red-400",
  medium: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400",
  low: "border-green-500/20 bg-green-500/5 text-green-400",
} as const;

export default async function InsightsPage() {
  // getSystemHealth() not needed here — insights derive patterns from
  // the incident log directly. Removing the unused health variable.
  const incidents = await getIncidents(50);
  const patterns = analyzePatterns(incidents);
  const recommendations = generateRecommendations(incidents, patterns);

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/platform"
            className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          >
            ← Platform
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              AI Insights
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Pattern analysis from {incidents.length} incidents
            </p>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h2 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Recommendations
          </h2>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`rounded-xl border p-5 ${PRIORITY_STYLES[rec.priority].split(" ").slice(0, 2).join(" ")}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase ${PRIORITY_STYLES[rec.priority]}`}
                  >
                    {rec.priority}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    {rec.title}
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {rec.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pattern breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Top Issue Labels
            </h2>
            {patterns.topLabels.length === 0 ? (
              <p className="text-xs text-zinc-600">No data yet</p>
            ) : (
              <div className="space-y-2">
                {patterns.topLabels.map(([label, count]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-32 truncate font-mono text-xs text-zinc-300">
                      {label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${(count / (patterns.topLabels[0]?.[1] ?? 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-zinc-500">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Event Type Split
            </h2>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-zinc-400">CI Failures</span>
                  <span className="text-zinc-500">{patterns.ciCount}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${incidents.length > 0 ? (patterns.ciCount / incidents.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-zinc-400">Runtime Errors</span>
                  <span className="text-zinc-500">{patterns.sentryCount}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{
                      width: `${incidents.length > 0 ? (patterns.sentryCount / incidents.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                Weekly Trend
              </h3>
              <div className="flex items-end gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-zinc-200">
                    {patterns.week1}
                  </div>
                  <div className="text-[10px] text-zinc-600">last 7d</div>
                </div>
                <div className="text-lg text-zinc-700">→</div>
                <div className="text-center">
                  <div className="text-xl font-bold text-zinc-500">
                    {patterns.week2}
                  </div>
                  <div className="text-[10px] text-zinc-600">prev 7d</div>
                </div>
                {patterns.week1 > patterns.week2 ? (
                  <span className="ml-auto text-xs text-red-400">
                    ↑ trending up
                  </span>
                ) : patterns.week1 < patterns.week2 ? (
                  <span className="ml-auto text-xs text-green-400">
                    ↓ improving
                  </span>
                ) : (
                  <span className="ml-auto text-xs text-zinc-500">
                    → stable
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top Services (bonus — topServices is computed, show it) */}
        {patterns.topServices.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Most Affected Services
            </h2>
            <div className="flex flex-wrap gap-3">
              {patterns.topServices.map(([service, count]) => (
                <div
                  key={service}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                >
                  <p className="text-sm font-medium text-zinc-200">{service}</p>
                  <p className="text-xs text-zinc-500">{count} incidents</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
