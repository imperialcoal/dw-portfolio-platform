import Link from "next/link";

import type { IncidentRecord, VercelDeployment } from "@dw/contracts";
import { getIncidents } from "@dw/ai/memory";
import { fetchRecentDeployments } from "@dw/ai/sensors";

import { env } from "~/env";

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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function findCorrelatedIncidents(
  deploy: VercelDeployment,
  incidents: IncidentRecord[],
): IncidentRecord[] {
  const deployTime = deploy.createdAt;
  const windowEnd = deployTime + 1000 * 60 * 60 * 2;
  return incidents.filter((incident) => {
    const incidentTime = new Date(incident.timestamp).getTime();
    return incidentTime >= deployTime && incidentTime <= windowEnd;
  });
}

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

const STATE_STYLES: Record<string, { badge: string; dot: string }> = {
  READY: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    dot: "bg-green-400",
  },
  ERROR: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
  },
  BUILDING: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
  },
  CANCELED: {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-400",
  },
};

const SEVERITY_COLOR: Record<IncidentRecord["severity"], string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-green-400",
};

function DeployRow({
  deploy,
  correlated,
  currentEnv,
}: {
  deploy: VercelDeployment;
  correlated: IncidentRecord[];
  currentEnv: string;
}) {
  const style = STATE_STYLES[deploy.state] ?? STATE_STYLES.CANCELED;
  const commitSha = deploy.meta.githubCommitSha ?? null;
  const commitMessage = deploy.meta.githubCommitMessage ?? null;
  const branch = deploy.meta.githubBranch ?? null;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${style?.badge}`}
          >
            {deploy.state}
          </span>
          {/* Show current env label — always accurate to which dashboard you're on */}
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-500">
            {currentEnv}
          </span>
          {branch !== null && (
            <span className="font-mono text-xs text-zinc-400">{branch}</span>
          )}
        </div>
        <span className="shrink-0 text-xs text-zinc-600">
          {formatDate(deploy.createdAt)}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {commitSha !== null && (
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400">
            {commitSha.slice(0, 7)}
          </span>
        )}
        {commitMessage !== null && (
          <p className="truncate text-sm text-zinc-300">{commitMessage}</p>
        )}
        <a
          href={`https://${deploy.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          View →
        </a>
      </div>

      {correlated.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Incidents within 2h of deploy
          </p>
          <div className="space-y-1.5">
            {correlated.map((incident) => (
              <div
                key={`${incident.type}-${incident.id}`}
                className="flex items-center gap-2"
              >
                <span
                  className={`text-[10px] font-semibold uppercase ${SEVERITY_COLOR[incident.severity]}`}
                >
                  {incident.severity}
                </span>
                <span className="truncate text-xs text-zinc-400">
                  {incident.summary}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-zinc-600">
                  {timeAgo(incident.timestamp)}
                </span>
                {incident.issueUrl !== undefined && (
                  <a
                    href={incident.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function DeploymentsPage() {
  const [deploys, incidents] = await Promise.all([
    fetchRecentDeployments(20),
    getIncidents(50),
  ]);

  // APP_ENV tells us which environment this dashboard is running in
  const currentEnv = env.NEXT_PUBLIC_APP_ENV;
  const deploysWithIncidents = deploys.filter(
    (d) => findCorrelatedIncidents(d, incidents).length > 0,
  );

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
              Deployments
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {deploys.length} recent {currentEnv} deployments · correlated with
              incident history
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="mb-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
              {currentEnv === "production" ? "Production" : "Preview"}
            </p>
            <p className="text-3xl font-bold text-white tabular-nums">
              {deploys.length}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="mb-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
              Successful
            </p>
            <p className="text-3xl font-bold text-white tabular-nums">
              {deploys.filter((d) => d.state === "READY").length}
            </p>
          </div>
          <div
            className={`rounded-xl border p-5 ${
              deploysWithIncidents.length > 0
                ? "border-orange-500/20 bg-orange-500/5"
                : "border-white/10 bg-white/5"
            }`}
          >
            <p className="mb-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
              With Incidents
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                deploysWithIncidents.length > 0
                  ? "text-orange-400"
                  : "text-white"
              }`}
            >
              {deploysWithIncidents.length}
            </p>
          </div>
        </div>

        {/* Deploy list */}
        {deploys.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-zinc-500">No deployments found.</p>
            <p className="mt-1 text-xs text-zinc-700">
              Add{" "}
              <code className="font-mono text-zinc-600">VERCEL_API_TOKEN</code>{" "}
              and{" "}
              <code className="font-mono text-zinc-600">VERCEL_PROJECT_ID</code>{" "}
              to Doppler to enable deployment tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {deploys.map((deploy) => (
              <DeployRow
                key={deploy.id}
                deploy={deploy}
                correlated={findCorrelatedIncidents(deploy, incidents)}
                currentEnv={currentEnv}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
