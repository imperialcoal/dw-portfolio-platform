// Health Overview
import Link from "next/link";

import type { IncidentRecord, VercelDeployment } from "@dw/contracts";
import { getIncidents, getSystemHealth } from "@dw/ai/memory";
import { getLastProductionDeploy } from "@dw/ai/sensors";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function severityColor(s: IncidentRecord["severity"] | "healthy") {
  return {
    critical: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/20",
      dot: "bg-red-400",
    },
    high: {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      border: "border-orange-500/20",
      dot: "bg-orange-400",
    },
    medium: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      border: "border-yellow-500/20",
      dot: "bg-yellow-400",
    },
    low: {
      bg: "bg-green-500/10",
      text: "text-green-400",
      border: "border-green-500/20",
      dot: "bg-green-400",
    },
    healthy: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      dot: "bg-emerald-400",
    },
  }[s];
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

function StatusDot({
  severity,
}: {
  severity: IncidentRecord["severity"] | "healthy";
}) {
  const c = severityColor(severity);
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c.dot} opacity-50`}
      />
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${c.dot}`}
      />
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  severity,
}: {
  label: string;
  value: string | number;
  sub?: string;
  severity?: IncidentRecord["severity"] | "healthy";
}) {
  const c = severity !== undefined ? severityColor(severity) : null;
  return (
    <div
      className={`rounded-xl border p-5 ${c !== null ? `${c.bg} ${c.border}` : "border-white/10 bg-white/5"}`}
    >
      <p className="mb-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={`text-3xl font-bold tabular-nums ${c !== null ? c.text : "text-white"}`}
      >
        {value}
      </p>
      {sub !== undefined && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function IncidentRow({ incident }: { incident: IncidentRecord }) {
  const c = severityColor(incident.severity);
  const typeLabel = incident.type === "ci_failure" ? "CI" : "Error";
  return (
    <div
      className={`flex items-start gap-4 rounded-lg border p-4 ${c.bg} ${c.border}`}
    >
      <div className="mt-1">
        <StatusDot severity={incident.severity} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${c.bg} ${c.text} border ${c.border}`}
          >
            {typeLabel}
          </span>
          <span className="text-[11px] text-zinc-500">{incident.service}</span>
          <span className="ml-auto text-[11px] text-zinc-600">
            {timeAgo(incident.timestamp)}
          </span>
        </div>
        <p className="truncate text-sm leading-snug font-medium text-zinc-200">
          {incident.summary}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
          {incident.rootCause}
        </p>
        {incident.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {incident.labels.slice(0, 4).map((l) => (
              <span
                key={l}
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400"
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
      {incident.issueUrl !== undefined && (
        <a
          href={incident.issueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Issue →
        </a>
      )}
    </div>
  );
}

function DeployCard({ deploy }: { deploy: VercelDeployment }) {
  const commitSha = deploy.meta.githubCommitSha ?? null;
  const commitMessage = deploy.meta.githubCommitMessage ?? null;
  const branch = deploy.meta.githubBranch ?? null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <p className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        Last Production Deploy
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="font-mono text-sm text-zinc-300">
            {commitSha !== null ? commitSha.slice(0, 7) : "—"}
          </p>
          <p className="text-xs text-zinc-500">commit</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div>
          <p className="text-sm text-zinc-300">
            {commitMessage !== null ? commitMessage.slice(0, 60) : "—"}
          </p>
          <p className="text-xs text-zinc-500">message</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div>
          <p className="text-sm text-zinc-300">{branch ?? "—"}</p>
          <p className="text-xs text-zinc-500">branch</p>
        </div>
        <a
          href={`https://${deploy.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          View deploy →
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function PlatformPage() {
  const [health, incidents, lastDeploy] = await Promise.all([
    getSystemHealth(),
    getIncidents(10),
    getLastProductionDeploy(),
  ]);

  const healthColor = severityColor(health.recentSeverity);
  const lastDeployTime =
    lastDeploy !== null
      ? timeAgo(new Date(lastDeploy.createdAt).toISOString())
      : "—";
  const lastDeployBranch =
    lastDeploy !== null
      ? (lastDeploy.meta.githubBranch ?? "unknown")
      : "no deploy found";

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Platform Intelligence
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              AI DevOps control center — updated in real-time
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${healthColor.bg} ${healthColor.border} ${healthColor.text}`}
          >
            <StatusDot severity={health.recentSeverity} />
            {health.recentSeverity === "healthy"
              ? "All systems healthy"
              : `${health.recentSeverity.toUpperCase()} severity active`}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Incidents (24h)"
            value={health.incidentCount24h}
            severity={
              health.incidentCount24h === 0 ? "healthy" : health.recentSeverity
            }
          />
          <StatCard
            label="Critical"
            value={health.criticalCount}
            severity={health.criticalCount > 0 ? "critical" : "healthy"}
          />
          <StatCard
            label="Total Incidents"
            value={incidents.length}
            sub="in memory (30d)"
          />
          <StatCard
            label="Last Deploy"
            value={lastDeployTime}
            sub={lastDeployBranch}
            severity={lastDeploy !== null ? "healthy" : undefined}
          />
        </div>

        {lastDeploy !== null && <DeployCard deploy={lastDeploy} />}

        {/* Recent Incidents */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
              Recent Incidents
            </h2>
            <Link
              href="/platform/incidents"
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              View all →
            </Link>
          </div>

          {incidents.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-sm text-zinc-500">
                No incidents recorded yet.
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Incidents appear here after the first CI failure or Sentry error
                is analyzed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <IncidentRow
                  key={`${incident.type}-${incident.id}`}
                  incident={incident}
                />
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="grid grid-cols-2 gap-4 pt-2 lg:grid-cols-3">
          {(
            [
              {
                href: "/platform/incidents",
                label: "All Incidents",
                desc: "Full incident history with AI analysis",
              },
              {
                href: "/platform/deployments",
                label: "Deployments",
                desc: "Deploy history and error correlation",
              },
              {
                href: "/platform/insights",
                label: "AI Insights",
                desc: "Recommendations and pattern analysis",
              },
            ] as const
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:border-white/20 hover:bg-white/8"
            >
              <p className="text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white">
                {item.label}
              </p>
              <p className="mt-1 text-xs text-zinc-600">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
