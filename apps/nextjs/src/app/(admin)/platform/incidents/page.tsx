import Link from "next/link";

import type { IncidentRecord } from "@dw/contracts";
import { getIncidents } from "@dw/ai/memory";

import { env } from "~/env";

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

function IncidentCard({ incident }: { incident: IncidentRecord }) {
  const s = SEVERITY_STYLES[incident.severity];
  const typeLabel =
    incident.type === "ci_failure" ? "CI Failure" : "Runtime Error";
  const ghRepo = env.NEXT_PUBLIC_GITHUB_REPO;

  return (
    <div className={`space-y-4 rounded-xl border p-5 ${s.card}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${s.badge}`}
            >
              {typeLabel}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${s.badge}`}
            >
              {incident.severity}
            </span>
            <span className="text-xs text-zinc-500">{incident.service}</span>
          </div>
          <h3 className="text-sm leading-snug font-semibold text-zinc-100">
            {incident.summary}
          </h3>
        </div>
        <span className="mt-1 shrink-0 text-xs text-zinc-600">
          {timeAgo(incident.timestamp)}
        </span>
      </div>

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

      {/* Links */}
      <div className="flex gap-4 pt-1">
        {incident.issueUrl !== undefined && (
          <a
            href={incident.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            → GitHub Issue
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
      </div>
    </div>
  );
}

export default async function IncidentsPage() {
  const incidents = await getIncidents(50);

  const bySeverity = (s: IncidentRecord["severity"]) =>
    incidents.filter((i) => i.severity === s);

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
              Incidents
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {incidents.length} total · last 30 days
            </p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3">
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
        </div>

        {incidents.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-zinc-500">No incidents yet.</p>
            <p className="mt-1 text-xs text-zinc-700">
              Incidents are recorded automatically when GitHub CI fails or a new
              Sentry error is detected.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <IncidentCard
                key={`${incident.type}-${incident.id}`}
                incident={incident}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
