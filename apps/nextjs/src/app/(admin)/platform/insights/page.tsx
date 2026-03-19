import Link from "next/link";

import type { IncidentRecord } from "@dw/contracts";
import { getIncidents } from "@dw/ai/memory";

// ─────────────────────────────────────────────
// Pattern analysis
// ─────────────────────────────────────────────

function analyzePatterns(incidents: IncidentRecord[]) {
  const active = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const resolved = incidents.filter(
    (i) => i.status === "resolved" || i.status === "closed",
  );
  const monitoring = incidents.filter((i) => i.status === "monitoring");

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
  const securityCount = incidents.filter(
    (i) => i.type === "security_alert",
  ).length;
  const activeSecurityCount = active.filter(
    (i) => i.type === "security_alert",
  ).length;

  const now = Date.now();
  const week1 = incidents.filter(
    (i) => now - new Date(i.timestamp).getTime() < 7 * 86_400_000,
  ).length;
  const week2 = incidents.filter((i) => {
    const age = now - new Date(i.timestamp).getTime();
    return age >= 7 * 86_400_000 && age < 14 * 86_400_000;
  }).length;

  const resolutionRate =
    incidents.length > 0
      ? Math.round((resolved.length / incidents.length) * 100)
      : 100;

  const resolvedWithTime = resolved.filter((i) => i.resolvedAt !== undefined);
  const avgResolutionHours =
    resolvedWithTime.length > 0
      ? Math.round(
          resolvedWithTime.reduce((sum, i) => {
            const detected = new Date(i.timestamp).getTime();
            const resolvedAt = new Date(i.resolvedAt ?? i.timestamp).getTime();
            return sum + (resolvedAt - detected) / (1000 * 60 * 60);
          }, 0) / resolvedWithTime.length,
        )
      : null;

  return {
    active,
    resolved,
    monitoring,
    topLabels,
    topServices,
    severityDist,
    ciCount,
    sentryCount,
    securityCount,
    activeSecurityCount,
    week1,
    week2,
    resolutionRate,
    avgResolutionHours,
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

  // Security alerts first — highest priority
  if (patterns.activeSecurityCount > 0) {
    recs.push({
      title: "Active security vulnerabilities need attention",
      description: `${patterns.activeSecurityCount} Dependabot security ${patterns.activeSecurityCount === 1 ? "alert is" : "alerts are"} unresolved. Review the incident details for affected packages and update to the patched versions as soon as possible.`,
      priority: "high",
    });
  }

  if (patterns.active.length > 0 && patterns.resolutionRate < 50) {
    recs.push({
      title: "Low resolution rate — active incidents need attention",
      description: `${patterns.active.length} incidents are unresolved out of ${incidents.length} total (${patterns.resolutionRate}% resolved). Review active incidents and close corresponding GitHub issues to update status.`,
      priority: "high",
    });
  }

  if (patterns.monitoring.length > 2) {
    recs.push({
      title: "Multiple incidents in monitoring state",
      description: `${patterns.monitoring.length} incidents are in monitoring after Sentry resolved them. Verify the fixes are stable and close the GitHub issues to mark them fully resolved.`,
      priority: "medium",
    });
  }

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

  if (
    patterns.severityDist.critical > 0 &&
    patterns.active.some((i) => i.severity === "critical")
  ) {
    recs.push({
      title: "Unresolved critical incidents",
      description: `${patterns.active.filter((i) => i.severity === "critical").length} critical incidents are still open. These should be the highest priority.`,
      priority: "high",
    });
  }

  if (
    patterns.avgResolutionHours !== null &&
    patterns.avgResolutionHours > 24
  ) {
    recs.push({
      title: "Resolution time exceeding 24h",
      description: `Average time to resolve incidents is ${patterns.avgResolutionHours}h. Consider setting up alerts for incidents open longer than 12h.`,
      priority: "medium",
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
  high: "border-red-500/20 bg-red-500/5",
  medium: "border-yellow-500/20 bg-yellow-500/5",
  low: "border-green-500/20 bg-green-500/5",
} as const;

const PRIORITY_TEXT = {
  high: "text-red-400",
  medium: "text-yellow-400",
  low: "text-green-400",
} as const;

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function InsightsPage() {
  const incidents = await getIncidents(100);
  const patterns = analyzePatterns(incidents);
  const recommendations = generateRecommendations(incidents, patterns);

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
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

        {/* Resolution health */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Resolution Rate",
              value: `${patterns.resolutionRate}%`,
              style:
                patterns.resolutionRate >= 80
                  ? "text-green-400"
                  : patterns.resolutionRate >= 50
                    ? "text-yellow-400"
                    : "text-red-400",
            },
            {
              label: "Avg Resolution",
              value:
                patterns.avgResolutionHours !== null
                  ? `${patterns.avgResolutionHours}h`
                  : "—",
              style: "text-white",
            },
            {
              label: "Active Now",
              value: patterns.active.length,
              style:
                patterns.active.length > 0 ? "text-red-400" : "text-green-400",
            },
            {
              label: "Security Alerts",
              value: patterns.securityCount,
              style:
                patterns.activeSecurityCount > 0
                  ? "text-purple-400"
                  : "text-zinc-400",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <p className="mb-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
                {item.label}
              </p>
              <p className={`text-3xl font-bold tabular-nums ${item.style}`}>
                {item.value}
              </p>
            </div>
          ))}
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
                className={`rounded-xl border p-5 ${PRIORITY_STYLES[rec.priority]}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase ${PRIORITY_STYLES[rec.priority]} border-current ${PRIORITY_TEXT[rec.priority]}`}
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
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-zinc-400">Security Alerts</span>
                  <span className="text-zinc-500">
                    {patterns.securityCount}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-violet-400"
                    style={{
                      width: `${incidents.length > 0 ? (patterns.securityCount / incidents.length) * 100 : 0}%`,
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

        {/* Top services */}
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

        {/* Resolution source breakdown */}
        {patterns.resolved.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Resolution Sources
            </h2>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  { key: "github_issue_closed", label: "GitHub Issue Closed" },
                  { key: "sentry_resolved", label: "Sentry Resolved" },
                  { key: "manual", label: "Manual Override" },
                ] as const
              ).map((source) => {
                const count = patterns.resolved.filter(
                  (i) => i.resolvedBy === source.key,
                ).length;
                if (count === 0) return null;
                return (
                  <div
                    key={source.key}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <p className="text-sm font-bold text-zinc-200">{count}</p>
                    <p className="text-xs text-zinc-500">{source.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
