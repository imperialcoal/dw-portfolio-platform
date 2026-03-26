import Link from "next/link";

import type {
  IncidentRecord,
  RollbackRecord,
  VercelDeployment,
} from "@dw/contracts";
import { getIncidents, getRollbackRecord } from "@dw/ai/memory";
import { fetchRecentDeployments } from "@dw/ai/sensors";

import { env } from "~/env";
import { RollbackButton } from "./_components/rollback-button";

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
  const windowEnd = deployTime + 1000 * 60 * 60 * 2; // 2h window
  return incidents.filter((incident) => {
    const incidentTime = new Date(incident.timestamp).getTime();
    return incidentTime >= deployTime && incidentTime <= windowEnd;
  });
}

// ─────────────────────────────────────────────
// Styles
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

const STATUS_BADGE: Record<string, string> = {
  open: "bg-red-500/10 text-red-400 border-red-500/20",
  investigating: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  monitoring: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  resolved: "bg-green-500/10 text-green-400 border-green-500/20",
  closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const RISK_STYLES: Record<
  RollbackRecord["riskLevel"],
  { text: string; bg: string; border: string }
> = {
  safe: {
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  risky: {
    text: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  destructive: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
};

const ROLLBACK_STATUS_STYLES: Record<
  RollbackRecord["status"],
  { label: string; text: string }
> = {
  executing: { label: "Executing", text: "text-blue-400" },
  success: { label: "Rolled back", text: "text-green-400" },
  failed: { label: "Failed", text: "text-red-400" },
  pending: { label: "Pending", text: "text-zinc-400" },
};

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

function RollbackAuditRow({ record }: { record: RollbackRecord }) {
  const risk = RISK_STYLES[record.riskLevel];
  const statusStyle = ROLLBACK_STATUS_STYLES[record.status];

  return (
    <div className={`rounded-lg border ${risk.border} ${risk.bg} px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
          Rollback
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${risk.bg} ${risk.border} ${risk.text}`}
        >
          {record.riskLevel}
        </span>
        <span className={`text-[11px] font-medium ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
          → {record.rollbackToSha.slice(0, 7)}
        </span>
        <span className="ml-auto text-[10px] text-zinc-600">
          {timeAgo(record.initiatedAt)}
        </span>
      </div>
      {record.changes.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {record.changes.map((change, i) => (
            <p key={i} className={`text-[11px] ${risk.text}`}>
              • {change}
            </p>
          ))}
        </div>
      )}
      {record.status === "failed" && record.error && (
        <p className="mt-1.5 text-[11px] text-red-400">{record.error}</p>
      )}
      {record.status === "success" && record.newDeploymentId && (
        <p className="mt-1 text-[10px] text-zinc-600">
          New deployment: {record.newDeploymentId}
        </p>
      )}
    </div>
  );
}

function DeployRow({
  deploy,
  correlated,
  currentEnv,
  rollbackRecord,
}: {
  deploy: VercelDeployment;
  correlated: IncidentRecord[];
  currentEnv: string;
  rollbackRecord: RollbackRecord | null;
}) {
  const style = STATE_STYLES[deploy.state] ??
    STATE_STYLES.CANCELED ?? {
      badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      dot: "bg-zinc-400",
    };
  const commitSha = deploy.meta.githubCommitSha ?? null;
  const commitMessage = deploy.meta.githubCommitMessage ?? null;
  const branch = deploy.meta.githubBranch ?? null;

  const activeCorrelated = correlated.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const resolvedCorrelated = correlated.filter(
    (i) => i.status === "resolved" || i.status === "closed",
  );

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${style.badge}`}
          >
            {deploy.state}
          </span>
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
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Rollback — only available for READY deployments with a commit SHA */}
          {deploy.state === "READY" && commitSha !== null && (
            <RollbackButton
              deploymentId={deploy.id}
              commitSha={commitSha}
              commitMessage={commitMessage ?? ""}
            />
          )}
          <a
            href={`https://${deploy.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            View →
          </a>
        </div>
      </div>

      {/* Rollback audit trail — shown if this deployment was used as a rollback target */}
      {rollbackRecord !== null && (
        <div className="border-t border-white/10 pt-3">
          <RollbackAuditRow record={rollbackRecord} />
        </div>
      )}

      {correlated.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Incidents within 2h of deploy
            {activeCorrelated.length > 0 && (
              <span className="ml-2 text-red-400">
                {activeCorrelated.length} active
              </span>
            )}
            {resolvedCorrelated.length > 0 && (
              <span className="ml-2 text-green-400">
                {resolvedCorrelated.length} resolved
              </span>
            )}
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
                <span
                  className={`rounded border px-1 py-0.5 text-[9px] font-semibold ${STATUS_BADGE[incident.status] ?? ""}`}
                >
                  {incident.status}
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
    getIncidents(100),
  ]);

  // Load rollback records for all deployments in parallel
  const rollbackRecords = await Promise.all(
    deploys.map((d) => getRollbackRecord(d.id).catch(() => null)),
  );

  const currentEnv = env.NEXT_PUBLIC_APP_ENV;
  const deploysWithActiveIncidents = deploys.filter((d) =>
    findCorrelatedIncidents(d, incidents).some(
      (i) => i.status === "open" || i.status === "investigating",
    ),
  );
  const deploysWithAnyIncidents = deploys.filter(
    (d) => findCorrelatedIncidents(d, incidents).length > 0,
  );
  const deploysWithRollbacks = rollbackRecords.filter((r) => r !== null).length;

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
              deploysWithActiveIncidents.length > 0
                ? "border-red-500/20 bg-red-500/5"
                : deploysWithAnyIncidents.length > 0
                  ? "border-orange-500/20 bg-orange-500/5"
                  : "border-white/10 bg-white/5"
            }`}
          >
            <p className="mb-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
              Active Incidents
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                deploysWithActiveIncidents.length > 0
                  ? "text-red-400"
                  : deploysWithAnyIncidents.length > 0
                    ? "text-orange-400"
                    : "text-white"
              }`}
            >
              {deploysWithActiveIncidents.length}
            </p>
            {deploysWithAnyIncidents.length >
              deploysWithActiveIncidents.length && (
              <p className="mt-1 text-xs text-zinc-600">
                {deploysWithAnyIncidents.length -
                  deploysWithActiveIncidents.length}{" "}
                resolved
              </p>
            )}
            {deploysWithRollbacks > 0 && (
              <p className="mt-1 text-xs text-zinc-600">
                {deploysWithRollbacks} rollback
                {deploysWithRollbacks === 1 ? "" : "s"} in window
              </p>
            )}
          </div>
        </div>

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
            {deploys.map((deploy, i) => (
              <DeployRow
                key={deploy.id}
                deploy={deploy}
                correlated={findCorrelatedIncidents(deploy, incidents)}
                currentEnv={currentEnv}
                rollbackRecord={rollbackRecords[i] ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
