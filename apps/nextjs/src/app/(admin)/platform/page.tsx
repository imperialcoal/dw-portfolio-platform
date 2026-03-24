// Platform Intelligence — Health Overview
import Link from "next/link";

import type { IncidentRecord, VercelDeployment } from "@dw/contracts";
import { getIncidents, getSystemHealth } from "@dw/ai/memory";
import { getLastProductionDeploy } from "@dw/ai/sensors";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SEVERITY_STYLES = {
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
} as const;

const STATUS_STYLES = {
  open: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
    label: "Open",
  },
  investigating: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dot: "bg-orange-400",
    label: "Investigating",
  },
  monitoring: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
    label: "Monitoring",
  },
  resolved: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    dot: "bg-green-400",
    label: "Resolved",
  },
  closed: {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-500",
    label: "Closed",
  },
} as const;

function severityColor(s: IncidentRecord["severity"] | "healthy") {
  return SEVERITY_STYLES[s];
}

function getTypeLabel(type: IncidentRecord["type"]): string {
  if (type === "ci_failure") return "CI";
  if (type === "security_alert") return "Security";
  return "Error";
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
  sub,
  value,
  severity,
}: {
  label: string;
  sub?: string;
  value: string | number;
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

function ActiveIncidentRow({ incident }: { incident: IncidentRecord }) {
  const sev = SEVERITY_STYLES[incident.severity];
  const status = STATUS_STYLES[incident.status];
  const isSecurityAlert = incident.type === "security_alert";
  const typeLabel = getTypeLabel(incident.type);

  const typeBadgeClass = isSecurityAlert
    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
    : `${sev.bg} ${sev.text} ${sev.border}`;

  return (
    <div
      className={`flex items-start gap-4 rounded-lg border p-4 ${
        isSecurityAlert
          ? "border-purple-500/20 bg-purple-500/5"
          : `${sev.bg} ${sev.border}`
      }`}
    >
      <div className="mt-1">
        <StatusDot severity={incident.severity} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${typeBadgeClass}`}
          >
            {typeLabel}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${status.badge}`}
          >
            {status.label}
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!isSecurityAlert && incident.commitSha !== undefined && (
            <span className="font-mono text-[10px] text-zinc-600">
              {incident.commitSha.slice(0, 7)}
            </span>
          )}
          {!isSecurityAlert && incident.branch !== undefined && (
            <span className="text-[10px] text-zinc-600">{incident.branch}</span>
          )}
          {incident.labels.slice(0, 3).map((l) => (
            <span
              key={l}
              className={`rounded border px-1.5 py-0.5 text-[10px] ${
                isSecurityAlert
                  ? "border-purple-500/20 bg-purple-500/10 text-purple-300"
                  : "border-white/10 bg-white/5 text-zinc-400"
              }`}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {incident.issueUrl !== undefined && (
          <a
            href={incident.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Issue →
          </a>
        )}
      </div>
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-300">
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
    getIncidents(50),
    getLastProductionDeploy(),
  ]);

  // Status buckets — mutually exclusive
  const activeIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const monitoringIncidents = incidents.filter(
    (i) => i.status === "monitoring",
  );
  const resolvedIncidents = incidents.filter(
    (i) => i.status === "resolved" || i.status === "closed",
  );
  const activeSecurityAlerts = activeIncidents.filter(
    (i) => i.type === "security_alert",
  );

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
              AI DevOps control center
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

        {/* Stats — incident status overview */}
        <div>
          <p className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Incident Status
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Active"
              value={activeIncidents.length}
              sub="open + investigating"
              severity={
                activeIncidents.length === 0 ? "healthy" : health.recentSeverity
              }
            />
            <StatCard
              label="Monitoring"
              value={monitoringIncidents.length}
              sub="watching for recurrence"
              severity={monitoringIncidents.length > 0 ? "medium" : "healthy"}
            />
            <StatCard
              label="Resolved (30d)"
              value={resolvedIncidents.length}
              sub="resolved + closed"
              severity="healthy"
            />
            <StatCard
              label="Last Deploy"
              value={lastDeployTime}
              sub={lastDeployBranch}
            />
          </div>
        </div>

        {/* Security alert banner */}
        {activeSecurityAlerts.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-400" />
            </span>
            <p className="text-sm font-medium text-purple-300">
              {activeSecurityAlerts.length} active security{" "}
              {activeSecurityAlerts.length === 1
                ? "vulnerability"
                : "vulnerabilities"}{" "}
              detected by Dependabot
            </p>
            <Link
              href="/platform/incidents"
              className="ml-auto text-xs text-purple-400 transition-colors hover:text-purple-200"
            >
              View →
            </Link>
          </div>
        )}

        {lastDeploy !== null && <DeployCard deploy={lastDeploy} />}

        {/* Active Incidents */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
              Active Incidents
              {activeIncidents.length > 0 && (
                <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                  {activeIncidents.length}
                </span>
              )}
            </h2>
            <Link
              href="/platform/incidents"
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              View all →
            </Link>
          </div>

          {activeIncidents.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <p className="text-sm font-medium text-emerald-400">
                No active incidents
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {incidents.length > 0
                  ? `${resolvedIncidents.length} resolved · ${monitoringIncidents.length} monitoring`
                  : "No incidents recorded yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeIncidents.map((incident) => (
                <ActiveIncidentRow
                  key={`${incident.type}-${incident.id}`}
                  incident={incident}
                />
              ))}
            </div>
          )}
        </div>

        {/* Monitoring */}
        {monitoringIncidents.length > 0 && (
          <div>
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
              Monitoring
              <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                {monitoringIncidents.length}
              </span>
            </h2>
            <div className="space-y-3">
              {monitoringIncidents.map((incident) => (
                <ActiveIncidentRow
                  key={`${incident.type}-${incident.id}`}
                  incident={incident}
                />
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="grid grid-cols-2 gap-4 pt-2 lg:grid-cols-3">
          {(
            [
              {
                href: "/platform/incidents",
                label: "Incident History",
                desc: "Full log with status tracking and AI analysis",
              },
              {
                href: "/platform/deployments",
                label: "Deployments",
                desc: "Deploy history with incident correlation",
              },
              {
                href: "/platform/insights",
                label: "AI Insights",
                desc: "Pattern analysis and recommendations",
              },
            ] as const
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:border-white/20"
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
