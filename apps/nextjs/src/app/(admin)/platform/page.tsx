// apps/nextjs/src/app/(admin)/platform/page.tsx
// Platform Intelligence — Health Overview
//
// CommandPalette is NO LONGER rendered here — it lives in layout.tsx which
// wraps all /platform/* pages. The layout provides the sticky top bar.
// This page only provides its own content with appropriate top padding.

import Link from "next/link";

import type { IncidentRecord, VercelDeployment } from "@dw/contracts";
import {
  getIncidents,
  getMaintenanceMode,
  getSystemHealth,
} from "@dw/ai/memory";
import { getLastProductionDeploy } from "@dw/ai/sensors";

import { env } from "~/env";
import { MaintenanceToggle } from "./_components/maintenance-toggle";
import { RunDocsAgentButton } from "./_components/run-docs-agent-button";
import { RunHealthCheckButton } from "./_components/run-health-check-button";

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

type SeverityKey = keyof typeof SEVERITY_STYLES;

function severityColor(s: string): (typeof SEVERITY_STYLES)[SeverityKey] {
  return SEVERITY_STYLES[s as SeverityKey];
}

const STATUS_STYLES = {
  open: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
  },
  investigating: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dot: "bg-orange-400",
  },
  monitoring: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
  },
  resolved: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    dot: "bg-green-400",
  },
  closed: {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-600",
  },
};

const TYPE_LABEL: Record<IncidentRecord["type"], string> = {
  ci_failure: "CI Failure",
  sentry_error: "Runtime Error",
  security_alert: "Security Alert",
  clerk_event: "Auth Event",
  uptime_failure: "Uptime",
  supabase_advisory: "DB Advisory",
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StatusDot({ severity }: { severity: string }) {
  const color =
    severity === "healthy"
      ? "bg-emerald-400"
      : severity === "critical"
        ? "bg-red-400"
        : severity === "high"
          ? "bg-orange-400"
          : severity === "medium"
            ? "bg-yellow-400"
            : "bg-green-400";
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {severity !== "healthy" && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-60`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
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
  sub: string;
  severity?: string;
}) {
  const color = severity ? severityColor(severity) : SEVERITY_STYLES.healthy;
  return (
    <div
      className={`rounded-xl border p-5 ${severity && severity !== "healthy" ? `${color.border} ${color.bg}` : "border-white/10 bg-white/5"}`}
    >
      <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums ${severity && severity !== "healthy" ? color.text : "text-white"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p>
    </div>
  );
}

function ActiveIncidentRow({ incident }: { incident: IncidentRecord }) {
  const statusStyle = STATUS_STYLES[incident.status];
  const severityStyle = SEVERITY_STYLES[incident.severity as SeverityKey];
  const typeLabel = TYPE_LABEL[incident.type];
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 ${severityStyle.border} ${severityStyle.bg}`}
    >
      <StatusDot severity={incident.severity} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded border bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityStyle.border} ${severityStyle.text}`}
          >
            {incident.severity}
          </span>
          <span className="text-[10px] text-zinc-600">{typeLabel}</span>
          <span
            className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle.badge}`}
          >
            {incident.status}
          </span>
        </div>
        <p className="text-sm font-medium text-zinc-200">{incident.summary}</p>
        {incident.issueUrl && (
          <a
            href={incident.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
          >
            GitHub Issue →
          </a>
        )}
      </div>
      <span className="shrink-0 text-[11px] text-zinc-700">
        {timeAgo(incident.timestamp)}
      </span>
    </div>
  );
}

function DeployCard({ deploy }: { deploy: VercelDeployment }) {
  const sha = deploy.meta.githubCommitSha?.slice(0, 7) ?? "—";
  const msg = deploy.meta.githubCommitMessage ?? "—";
  const branch = deploy.meta.githubBranch ?? deploy.target ?? "—";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <p className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
        Last Production Deploy
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400">
            {sha}
          </span>
          <p className="truncate text-sm text-zinc-300">{msg}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-zinc-600">{branch}</span>
          <a
            href={`https://${deploy.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            View deploy →
          </a>
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  {
    href: "/platform/incidents",
    label: "Incident History",
    desc: "Full log with status tracking and AI analysis",
  },
  {
    href: "/platform/deployments",
    label: "Deployments",
    desc: "Deploy history with incident correlation and one-click rollback",
  },
  {
    href: "/platform/insights",
    label: "AI Insights",
    desc: "Pattern analysis and recommendations",
  },
  {
    href: "/platform/dependencies",
    label: "Dependencies",
    desc: "Manage Dependabot PRs and security vulnerabilities",
  },
  {
    href: "/platform/users",
    label: "User Activity",
    desc: "Clerk auth events, sign-ins, and security signals",
  },
  {
    href: "/platform/database",
    label: "Database Health",
    desc: "Supabase table sizes, connections, and security advisories",
  },
] as const;

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function PlatformPage() {
  const [health, incidents, lastDeploy, maintenanceMode] = await Promise.all([
    getSystemHealth(),
    getIncidents(50),
    getLastProductionDeploy(),
    getMaintenanceMode().catch(() => null),
  ]);

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
    (i) => i.type === "security_alert" || i.type === "supabase_advisory",
  );
  const activeAuthAlerts = activeIncidents.filter(
    (i) => i.type === "clerk_event",
  );
  const uptimeIncidents = activeIncidents.filter(
    (i) => i.type === "uptime_failure",
  );

  const healthColor = severityColor(health.recentSeverity);
  const lastDeployTime =
    lastDeploy !== null
      ? timeAgo(new Date(lastDeploy.createdAt).toISOString())
      : "—";
  const lastDeployBranch =
    lastDeploy !== null
      ? (lastDeploy.meta.githubBranch ?? lastDeploy.target ?? "main")
      : "no deploy found";

  const currentEnv = env.NEXT_PUBLIC_APP_ENV;
  const docsBranch = currentEnv === "production" ? "main" : "dev";

  return (
    // No bg/min-h here — layout.tsx owns the full-page background
    // pt-6 accounts for the sticky command palette bar from the layout
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header — title + system status pill */}
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

        {/* Stats */}
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

        {/* Alert banners */}
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
                : "vulnerabilities"}
            </p>
            <Link
              href="/platform/incidents"
              className="ml-auto text-xs text-purple-400 transition-colors hover:text-purple-200"
            >
              View →
            </Link>
          </div>
        )}

        {activeAuthAlerts.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
            </span>
            <p className="text-sm font-medium text-orange-300">
              {activeAuthAlerts.length} auth security{" "}
              {activeAuthAlerts.length === 1 ? "signal" : "signals"} — possible
              brute force
            </p>
            <Link
              href="/platform/users"
              className="ml-auto text-xs text-orange-400 transition-colors hover:text-orange-200"
            >
              View users →
            </Link>
          </div>
        )}

        {uptimeIncidents.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
            </span>
            <p className="text-sm font-medium text-red-300">
              {uptimeIncidents.length}{" "}
              {uptimeIncidents.length === 1 ? "service is" : "services are"}{" "}
              unreachable
            </p>
            <Link
              href="/platform/incidents"
              className="ml-auto text-xs text-red-400 transition-colors hover:text-red-200"
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

        {/* Nav grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 lg:grid-cols-3">
          {NAV_ITEMS.map((item) => (
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

          {/* Documentation — manual trigger */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-zinc-200">Documentation</p>
            <p className="mt-1 text-xs text-zinc-600">
              Detect drift and append changelogs to ARCHITECTURE, OPERATIONS,
              and PLAYBOOKS
            </p>
            <RunDocsAgentButton branch={docsBranch} />
          </div>

          {/* Uptime — manual trigger */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-zinc-200">Uptime</p>
            <p className="mt-1 text-xs text-zinc-600">
              Check production, preview, and API endpoints for availability
            </p>
            <RunHealthCheckButton />
          </div>
        </div>

        {/* Maintenance Mode */}
        <div>
          <p className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Operations
          </p>
          <MaintenanceToggle initial={maintenanceMode} />
        </div>
      </div>
    </div>
  );
}
