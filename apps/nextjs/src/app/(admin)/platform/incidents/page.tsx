import Link from "next/link";

import type { IncidentRecord } from "@dw/contracts";
import { getIncidents } from "@dw/ai/memory";

import { env } from "~/env";
import { ResolveButtonWithRefresh } from "./_components/resolve-button-with-refresh";

const SEVERITY_STYLES = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  high: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  medium: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  low: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
  },
} as const;

const STATUS_STYLES = {
  open: { badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  investigating: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  monitoring: { badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  resolved: { badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  closed: { badge: "bg-muted text-muted-foreground border-border" },
} as const;

const TYPE_LABEL: Record<IncidentRecord["type"], string> = {
  ci_failure: "CI Failure",
  sentry_error: "Runtime Error",
  security_alert: "Security Alert",
  clerk_event: "Auth Event",
  uptime_failure: "Uptime",
  supabase_advisory: "DB Advisory",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function IncidentCard({ incident }: { incident: IncidentRecord }) {
  const sev = SEVERITY_STYLES[incident.severity];
  const status = STATUS_STYLES[incident.status];
  const isSecurityAlert = incident.type === "security_alert";
  const typeLabel = TYPE_LABEL[incident.type];
  const ghRepo = env.NEXT_PUBLIC_GITHUB_REPO;
  const isResolved =
    incident.status === "resolved" || incident.status === "closed";

  return (
    <div
      className={`space-y-4 rounded-xl border p-5 ${isResolved ? "border-border bg-muted/40 opacity-80" : isSecurityAlert ? "border-purple-500/20 bg-purple-500/5" : `${sev.border} ${sev.bg}`}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${isSecurityAlert ? "border-purple-500/20 bg-purple-500/10 text-purple-400" : sev.badge}`}
          >
            {typeLabel}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${sev.badge}`}
          >
            {incident.severity}
          </span>
          <span
            className={`rounded border bg-transparent px-1.5 py-0.5 text-[10px] font-semibold ${status.badge}`}
          >
            {incident.status}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">
          {timeAgo(incident.timestamp)}
        </span>
      </div>

      <p className="text-foreground text-sm font-medium">{incident.summary}</p>

      {isSecurityAlert && incident.labels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-purple-500/10 bg-purple-500/5 px-3 py-2">
          <span className="text-[10px] font-semibold tracking-widest text-purple-500 uppercase">
            Vulnerability
          </span>
          {incident.labels.slice(0, 5).map((l) => (
            <span
              key={l}
              className="rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-400"
            >
              {l}
            </span>
          ))}
        </div>
      ) : (
        (incident.commitSha !== undefined || incident.branch !== undefined) && (
          <div className="border-border bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
              Correlation
            </span>
            {incident.commitSha !== undefined && (
              <span className="text-muted-foreground font-mono text-[11px]">
                {incident.commitSha.slice(0, 7)}
              </span>
            )}
            {incident.branch !== undefined && (
              <span className="text-muted-foreground text-[11px]">
                {incident.branch}
              </span>
            )}
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="border-border bg-muted/30 rounded-lg border p-3">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-widest uppercase">
            Root Cause
          </p>
          <p className="text-foreground text-xs leading-relaxed">
            {incident.rootCause}
          </p>
        </div>
        <div className="border-border bg-muted/30 rounded-lg border p-3">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-widest uppercase">
            Summary
          </p>
          <p className="text-foreground text-xs leading-relaxed">
            {incident.summary}
          </p>
        </div>
      </div>

      {!isSecurityAlert && incident.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {incident.labels.map((l) => (
            <span
              key={l}
              className="border-border bg-muted/40 text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]"
            >
              {l}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {incident.issueUrl !== undefined && (
          <a
            href={incident.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            → GitHub Issue
          </a>
        )}
        {incident.sentryIssueUrl !== undefined && (
          <a
            href={incident.sentryIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            → Sentry Issue
          </a>
        )}
        {incident.incidentDocPath !== undefined && ghRepo !== "" && (
          <a
            href={`https://github.com/${ghRepo}/blob/dev/${incident.incidentDocPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            → Incident Doc
          </a>
        )}
        {isSecurityAlert && incident.sentryIssueId !== undefined && (
          <span className="text-muted-foreground text-xs">
            Alert #{incident.sentryIssueId}
          </span>
        )}
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
      <h2 className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
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

export default async function IncidentsPage() {
  const incidents = await getIncidents(100);
  const active = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const monitoring = incidents.filter((i) => i.status === "monitoring");
  const resolved = incidents.filter((i) => i.status === "resolved");
  const closed = incidents.filter((i) => i.status === "closed");
  const resolvedOrClosed = [...resolved, ...closed];
  const bySeverity = (s: IncidentRecord["severity"]) =>
    incidents.filter((i) => i.severity === s);
  const securityCount = incidents.filter(
    (i) => i.type === "security_alert",
  ).length;

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="flex items-center gap-4">
          <Link
            href="/platform"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            ← Platform
          </Link>
          <div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              Incidents
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {incidents.length} total · {active.length} active ·{" "}
              {resolvedOrClosed.length} resolved
              {securityCount > 0 && (
                <span className="text-purple-400">
                  {" "}
                  · {securityCount} security
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="border-border bg-muted/40 space-y-5 rounded-xl border p-5">
          <div className="space-y-2">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
              By Status
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "Open",
                  count: active.filter((i) => i.status === "open").length,
                  style: "border-red-500/20 bg-red-500/10 text-red-400",
                },
                {
                  label: "Investigating",
                  count: active.filter((i) => i.status === "investigating")
                    .length,
                  style:
                    "border-orange-500/20 bg-orange-500/10 text-orange-400",
                },
                {
                  label: "Monitoring",
                  count: monitoring.length,
                  style: "border-blue-500/20 bg-blue-500/10 text-blue-400",
                },
                {
                  label: "Resolved",
                  count: resolved.length,
                  style: "border-green-500/20 bg-green-500/10 text-green-400",
                },
                {
                  label: "Closed",
                  count: closed.length,
                  style: "border-border bg-muted/60 text-muted-foreground",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`flex min-w-16 flex-col items-center rounded-lg border px-3 py-2 ${s.style}`}
                >
                  <p className="text-lg leading-none font-bold tabular-nums">
                    {s.count}
                  </p>
                  <p className="mt-1 text-[10px] tracking-wide uppercase">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
              By Severity (all time)
            </p>
            <div className="flex flex-wrap gap-2">
              {(["critical", "high", "medium", "low"] as const).map((sev) => (
                <div
                  key={sev}
                  className={`flex min-w-16 flex-col items-center rounded-lg border px-3 py-2 ${SEVERITY_STYLES[sev].border} ${SEVERITY_STYLES[sev].bg}`}
                >
                  <p
                    className={`text-lg leading-none font-bold tabular-nums ${SEVERITY_STYLES[sev].text}`}
                  >
                    {bySeverity(sev).length}
                  </p>
                  <p
                    className={`mt-1 text-[10px] tracking-wide uppercase ${SEVERITY_STYLES[sev].text}`}
                  >
                    {sev}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {active.length > 0 && (
          <div className="space-y-4">
            <SectionHeader
              title="Active"
              count={active.length}
              countStyle="bg-red-500/10 text-red-400"
            />
            {active.map((i) => (
              <IncidentCard key={i.id} incident={i} />
            ))}
          </div>
        )}
        {monitoring.length > 0 && (
          <div className="space-y-4">
            <SectionHeader
              title="Monitoring"
              count={monitoring.length}
              countStyle="bg-blue-500/10 text-blue-400"
            />
            {monitoring.map((i) => (
              <IncidentCard key={i.id} incident={i} />
            ))}
          </div>
        )}
        {resolvedOrClosed.length > 0 && (
          <div className="space-y-4">
            <SectionHeader
              title="Resolved & Closed"
              count={resolvedOrClosed.length}
              countStyle="bg-muted text-muted-foreground"
            />
            {resolvedOrClosed.map((i) => (
              <IncidentCard key={i.id} incident={i} />
            ))}
          </div>
        )}

        {incidents.length === 0 && (
          <div className="border-border bg-muted/40 rounded-xl border py-16 text-center">
            <p className="text-sm font-medium text-emerald-500">
              No incidents recorded
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              The platform agent will create incidents automatically as issues
              are detected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
