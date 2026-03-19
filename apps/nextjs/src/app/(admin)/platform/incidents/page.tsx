import Link from "next/link";

import type { IncidentRecord, IncidentStatus } from "@dw/contracts";
import { getIncidents } from "@dw/ai/memory";

import { env } from "~/env";
import { ResolveButtonWithRefresh } from "./_components/resolve-button-with-refresh";

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

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SEVERITY_STYLES = {
  critical: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    card: "border-red-500/20 bg-red-500/5",
  },
  high: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    card: "border-orange-500/20 bg-orange-500/5",
  },
  medium: {
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    card: "border-yellow-500/20 bg-yellow-500/5",
  },
  low: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    card: "border-green-500/20 bg-green-500/5",
  },
} as const;

const STATUS_STYLES: Record<IncidentStatus, { badge: string; label: string }> =
  {
    open: {
      badge: "bg-red-500/10 text-red-400 border-red-500/20",
      label: "Open",
    },
    investigating: {
      badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      label: "Investigating",
    },
    monitoring: {
      badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      label: "Monitoring",
    },
    resolved: {
      badge: "bg-green-500/10 text-green-400 border-green-500/20",
      label: "Resolved",
    },
    closed: {
      badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      label: "Closed",
    },
  };

// Type badge styles — security alerts get a distinct purple treatment
const TYPE_BADGE: Record<IncidentRecord["type"], string> = {
  ci_failure: "", // uses severity color (existing behavior)
  sentry_error: "", // uses severity color (existing behavior)
  security_alert: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const TYPE_LABEL: Record<IncidentRecord["type"], string> = {
  ci_failure: "CI Failure",
  sentry_error: "Runtime Error",
  security_alert: "Security Alert",
};

const RESOLVED_BY_LABELS: Record<
  NonNullable<IncidentRecord["resolvedBy"]>,
  string
> = {
  github_issue_closed: "GitHub issue closed",
  sentry_resolved: "Sentry resolved",
  manual: "Manual override",
};

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

function IncidentCard({ incident }: { incident: IncidentRecord }) {
  const sev = SEVERITY_STYLES[incident.severity];
  const status = STATUS_STYLES[incident.status];
  const isSecurityAlert = incident.type === "security_alert";
  const typeBadgeClass = isSecurityAlert
    ? TYPE_BADGE.security_alert
    : sev.badge;
  const typeLabel = TYPE_LABEL[incident.type];
  const ghRepo = env.NEXT_PUBLIC_GITHUB_REPO;
  const isResolved =
    incident.status === "resolved" || incident.status === "closed";

  return (
    <div
      className={`space-y-4 rounded-xl border p-5 ${
        isResolved
          ? "border-white/10 bg-white/5 opacity-80"
          : isSecurityAlert
            ? "border-purple-500/20 bg-purple-500/5"
            : sev.card
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${typeBadgeClass}`}
            >
              {typeLabel}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${sev.badge}`}
            >
              {incident.severity}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${status.badge}`}
            >
              {status.label}
            </span>
            <span className="text-xs text-zinc-500">{incident.service}</span>
          </div>
          <h3 className="text-sm leading-snug font-semibold text-zinc-100">
            {incident.summary}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-zinc-600">{timeAgo(incident.timestamp)}</p>
          <p className="text-[10px] text-zinc-700">
            {formatDate(incident.timestamp)}
          </p>
        </div>
      </div>

      {/* Correlation row — CI/Sentry show commit+branch, security shows package+CVE */}
      {isSecurityAlert
        ? // Security alert correlation: package name, ecosystem, CVE/GHSA
          // Labels carry this info since we don't have a separate context field here
          incident.labels.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-purple-500/10 bg-purple-500/5 px-3 py-2">
              <span className="text-[10px] font-semibold tracking-widest text-purple-700 uppercase">
                Vulnerability
              </span>
              {incident.labels.slice(0, 5).map((l) => (
                <span
                  key={l}
                  className="rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-300"
                >
                  {l}
                </span>
              ))}
            </div>
          )
        : // CI/Sentry correlation: commit SHA + branch
          (incident.commitSha !== undefined ||
            incident.branch !== undefined) && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <span className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                Correlation
              </span>
              {incident.commitSha !== undefined && (
                <span className="font-mono text-[11px] text-zinc-400">
                  {incident.commitSha.slice(0, 7)}
                </span>
              )}
              {incident.branch !== undefined && (
                <span className="text-[11px] text-zinc-500">
                  {incident.branch}
                </span>
              )}
            </div>
          )}

      {/* AI Analysis */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-white/5 bg-black/30 p-3">
          <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Root Cause
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            {incident.rootCause}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/30 p-3">
          <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Labels
          </p>
          <div className="flex flex-wrap gap-1.5">
            {incident.labels.map((l) => (
              <span
                key={l}
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Resolution info */}
      {isResolved && incident.resolvedAt !== undefined && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-semibold tracking-widest text-green-600 uppercase">
              Resolved
            </span>
            <span className="text-xs text-green-400">
              {timeAgo(incident.resolvedAt)}
            </span>
            {incident.resolvedBy !== undefined && (
              <span className="text-xs text-zinc-500">
                {RESOLVED_BY_LABELS[incident.resolvedBy]}
              </span>
            )}
            {incident.resolutionNote !== undefined && (
              <span className="text-xs text-zinc-600">
                · {incident.resolutionNote}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Links + Manual Resolve */}
      <div className="flex flex-wrap items-center gap-4 pt-1">
        {incident.issueUrl !== undefined && (
          <a
            href={incident.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            → GitHub Issue
            {incident.githubIssueNumber !== undefined && (
              <span className="ml-1 text-zinc-600">
                #{incident.githubIssueNumber}
              </span>
            )}
          </a>
        )}
        {incident.incidentDocPath !== undefined && ghRepo !== "" && (
          <a
            href={`https://github.com/${ghRepo}/blob/dev/${incident.incidentDocPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            → Incident Doc
          </a>
        )}
        {/* For security alerts, sentryIssueId stores the alert number — show alert link */}
        {isSecurityAlert && incident.sentryIssueId !== undefined && (
          <span className="text-xs text-zinc-600">
            Alert #{incident.sentryIssueId}
          </span>
        )}
        {/* For Sentry incidents, show Sentry issue ID */}
        {!isSecurityAlert && incident.sentryIssueId !== undefined && (
          <span className="text-xs text-zinc-600">
            Sentry #{incident.sentryIssueId}
          </span>
        )}
        {/* Manual resolution — only for non-resolved/closed incidents */}
        <div className="ml-auto">
          <ResolveButtonWithRefresh
            incidentId={incident.id}
            currentStatus={incident.status}
          />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  countStyle,
}: {
  title: string;
  count: number;
  countStyle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
        {title}
      </h2>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${countStyle}`}
      >
        {count}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function IncidentsPage() {
  const incidents = await getIncidents(100);

  const active = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const monitoring = incidents.filter((i) => i.status === "monitoring");
  const resolved = incidents.filter(
    (i) => i.status === "resolved" || i.status === "closed",
  );

  const bySeverity = (s: IncidentRecord["severity"]) =>
    incidents.filter((i) => i.severity === s);

  const securityCount = incidents.filter(
    (i) => i.type === "security_alert",
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-10">
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
              Incidents
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {incidents.length} total · {active.length} active ·{" "}
              {resolved.length} resolved
              {securityCount > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-purple-400">
                    {securityCount} security
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            {
              label: "Open",
              count: incidents.filter((i) => i.status === "open").length,
              style: "border-red-500/20 bg-red-500/5 text-red-400",
            },
            {
              label: "Investigating",
              count: incidents.filter((i) => i.status === "investigating")
                .length,
              style: "border-orange-500/20 bg-orange-500/5 text-orange-400",
            },
            {
              label: "Monitoring",
              count: monitoring.length,
              style: "border-blue-500/20 bg-blue-500/5 text-blue-400",
            },
            {
              label: "Resolved",
              count: incidents.filter((i) => i.status === "resolved").length,
              style: "border-green-500/20 bg-green-500/5 text-green-400",
            },
            {
              label: "Closed",
              count: incidents.filter((i) => i.status === "closed").length,
              style: "border-zinc-500/20 bg-zinc-500/5 text-zinc-400",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border p-3 text-center ${item.style}`}
            >
              <p className="text-xl font-bold tabular-nums">{item.count}</p>
              <p className="mt-0.5 text-[10px] tracking-widest text-zinc-600 uppercase">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Severity + type breakdown */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(["critical", "high", "medium", "low"] as const).map((s) => (
            <div
              key={s}
              className={`rounded-lg border p-3 text-center ${SEVERITY_STYLES[s].card}`}
            >
              <p
                className={`text-xl font-bold tabular-nums ${SEVERITY_STYLES[s].badge.split(" ")[1] ?? ""}`}
              >
                {bySeverity(s).length}
              </p>
              <p className="mt-0.5 text-[10px] tracking-widest text-zinc-600 uppercase">
                {s}
              </p>
            </div>
          ))}
          {/* Security alert count chip */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-center">
            <p className="text-xl font-bold text-purple-400 tabular-nums">
              {securityCount}
            </p>
            <p className="mt-0.5 text-[10px] tracking-widest text-zinc-600 uppercase">
              security
            </p>
          </div>
        </div>

        {incidents.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-zinc-500">No incidents yet.</p>
            <p className="mt-1 text-xs text-zinc-700">
              Incidents are recorded automatically when GitHub CI fails, a new
              Sentry error is detected, or Dependabot flags a vulnerability.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Active */}
            {active.length > 0 && (
              <div className="space-y-4">
                <SectionHeader
                  title="Active"
                  count={active.length}
                  countStyle="bg-red-500/10 text-red-400"
                />
                {active.map((incident) => (
                  <IncidentCard
                    key={`${incident.type}-${incident.id}`}
                    incident={incident}
                  />
                ))}
              </div>
            )}

            {/* Monitoring */}
            {monitoring.length > 0 && (
              <div className="space-y-4">
                <SectionHeader
                  title="Monitoring"
                  count={monitoring.length}
                  countStyle="bg-blue-500/10 text-blue-400"
                />
                {monitoring.map((incident) => (
                  <IncidentCard
                    key={`${incident.type}-${incident.id}`}
                    incident={incident}
                  />
                ))}
              </div>
            )}

            {/* History */}
            {resolved.length > 0 && (
              <div className="space-y-4">
                <SectionHeader
                  title="Resolved History"
                  count={resolved.length}
                  countStyle="bg-zinc-500/10 text-zinc-400"
                />
                {resolved.map((incident) => (
                  <IncidentCard
                    key={`${incident.type}-${incident.id}`}
                    incident={incident}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
