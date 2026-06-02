import Link from "next/link";

import type { IncidentRecord } from "@dw/contracts";
import { getIncidents } from "@dw/ai/memory";

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
  const resolutionHours = resolved
    .filter((i) => i.resolvedAt !== undefined)
    .map(
      (i) =>
        (new Date(i.resolvedAt ?? i.timestamp).getTime() -
          new Date(i.timestamp).getTime()) /
        3_600_000,
    );
  const avgResolutionHours =
    resolutionHours.length > 0
      ? Math.round(
          resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length,
        )
      : null;
  const resolutionRate =
    incidents.length > 0
      ? Math.round((resolved.length / incidents.length) * 100)
      : 100;
  const severityDist = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const i of incidents) {
    if (i.severity in severityDist) severityDist[i.severity]++;
  }
  return {
    active,
    resolved,
    monitoring,
    topLabels,
    serviceCounts,
    avgResolutionHours,
    resolutionRate,
    severityDist,
  };
}

function generateRecommendations(
  incidents: IncidentRecord[],
  patterns: ReturnType<typeof analyzePatterns>,
) {
  const recs: {
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[] = [];
  if (patterns.active.length > 3)
    recs.push({
      title: "High active incident count",
      description: `${patterns.active.length} incidents are currently active. Review recent changes and consider a stability sprint.`,
      priority: "high",
    });
  if (
    patterns.severityDist.critical > 0 &&
    patterns.active.some((i) => i.severity === "critical")
  )
    recs.push({
      title: "Unresolved critical incidents",
      description: `${patterns.active.filter((i) => i.severity === "critical").length} critical incidents are still open. These should be the highest priority.`,
      priority: "high",
    });
  if (patterns.avgResolutionHours !== null && patterns.avgResolutionHours > 24)
    recs.push({
      title: "Resolution time exceeding 24h",
      description: `Average time to resolve incidents is ${patterns.avgResolutionHours}h. Consider setting up alerts for incidents open longer than 12h.`,
      priority: "medium",
    });
  if (recs.length === 0)
    recs.push({
      title: "System looks healthy",
      description:
        "No urgent patterns detected from recent incidents. Keep monitoring.",
      priority: "low",
    });
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

export default async function InsightsPage() {
  const incidents = await getIncidents(100);
  const patterns = analyzePatterns(incidents);
  const recommendations = generateRecommendations(incidents, patterns);

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/platform"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            ← Platform
          </Link>
          <div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              AI Insights
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Pattern analysis from {incidents.length} incidents
            </p>
          </div>
        </div>

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
              style: "text-foreground",
            },
            {
              label: "Active Now",
              value: patterns.active.length,
              style:
                patterns.active.length > 0
                  ? "text-red-400"
                  : "text-emerald-400",
            },
            {
              label: "Monitoring",
              value: patterns.monitoring.length,
              style:
                patterns.monitoring.length > 0
                  ? "text-blue-400"
                  : "text-foreground",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-border bg-muted/40 rounded-xl border p-5"
            >
              <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
                {stat.label}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${stat.style}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-muted-foreground mb-4 text-sm font-semibold tracking-widest uppercase">
            Recommendations
          </h2>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${PRIORITY_STYLES[rec.priority]}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold tracking-widest uppercase ${PRIORITY_TEXT[rec.priority]}`}
                  >
                    {rec.priority}
                  </span>
                  <p className="text-foreground text-sm font-medium">
                    {rec.title}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  {rec.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {patterns.topLabels.length > 0 && (
          <div>
            <h2 className="text-muted-foreground mb-4 text-sm font-semibold tracking-widest uppercase">
              Top Labels
            </h2>
            <div className="flex flex-wrap gap-2">
              {patterns.topLabels.map(([label, count]) => (
                <div
                  key={label}
                  className="border-border bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-1.5"
                >
                  <span className="text-foreground text-sm">{label}</span>
                  <span className="text-muted-foreground text-xs">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
