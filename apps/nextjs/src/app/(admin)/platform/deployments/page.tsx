import Link from "next/link";

import type {
  IncidentRecord,
  RollbackRecord,
  VercelDeployment,
} from "@dw/contracts";
import { getIncidents, getRollbackRecord } from "@dw/ai/memory";
import { fetchLiveDeploymentId, fetchRecentDeployments } from "@dw/ai/sensors";

import { env } from "~/env";
import { RollbackButton } from "./_components/rollback-button";

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

const STATE_STYLES: Record<string, { badge: string }> = {
  READY: { badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  ERROR: { badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  BUILDING: { badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  CANCELED: { badge: "bg-muted text-muted-foreground border-border" },
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
  closed: "bg-muted text-muted-foreground border-border",
};

const RISK_STYLES = {
  safe: {
    bg: "bg-green-500/5",
    border: "border-green-500/20",
    text: "text-green-400",
  },
  risky: {
    bg: "bg-yellow-500/5",
    border: "border-yellow-500/20",
    text: "text-yellow-400",
  },
  destructive: {
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    text: "text-red-400",
  },
} as const;

function RollbackAuditRow({ record }: { record: RollbackRecord }) {
  const risk = RISK_STYLES[record.riskLevel];
  const statusStyle = {
    pending: { text: "text-muted-foreground", label: "Pending" },
    executing: { text: "text-blue-400", label: "Executing…" },
    success: { text: "text-green-400", label: "Succeeded" },
    failed: { text: "text-red-400", label: "Failed" },
  }[record.status];
  return (
    <div className={`rounded-lg border p-3 ${risk.bg} ${risk.border}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-muted-foreground font-medium">Rollback</span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${risk.bg} ${risk.border} ${risk.text}`}
        >
          {record.riskLevel}
        </span>
        <span className={`text-[11px] font-medium ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
        <span className="text-muted-foreground font-mono text-[10px]">
          → {record.rollbackToSha.slice(0, 7)}
        </span>
        <span className="text-muted-foreground ml-auto text-[10px]">
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
    </div>
  );
}

function DeployRow({
  deploy,
  correlated,
  currentEnv,
  rollbackRecord,
  isCurrentLive,
}: {
  deploy: VercelDeployment;
  correlated: IncidentRecord[];
  currentEnv: string;
  rollbackRecord: RollbackRecord | null;
  isCurrentLive: boolean;
}) {
  const style = STATE_STYLES[deploy.state] ?? {
    badge: "bg-muted text-muted-foreground border-border",
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
  const canRollback =
    deploy.state === "READY" && commitSha !== null && !isCurrentLive;

  return (
    <div
      className={`space-y-3 rounded-xl border p-5 ${isCurrentLive ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-muted/40"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${style.badge}`}
          >
            {deploy.state}
          </span>
          {isCurrentLive && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              LIVE
            </span>
          )}
          <span className="border-border bg-muted/40 text-muted-foreground rounded border px-1.5 py-0.5 text-[11px]">
            {currentEnv}
          </span>
          {branch !== null && (
            <span className="text-muted-foreground font-mono text-xs">
              {branch}
            </span>
          )}
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {formatDate(deploy.createdAt)}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {commitSha !== null && (
          <span className="border-border bg-muted/40 text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
            {commitSha.slice(0, 7)}
          </span>
        )}
        {commitMessage !== null && (
          <p className="text-foreground truncate text-sm">{commitMessage}</p>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canRollback && (
            <RollbackButton
              deploymentId={deploy.id}
              deploymentUrl={deploy.url}
              commitSha={commitSha}
              commitMessage={commitMessage ?? ""}
            />
          )}
          <a
            href={`https://${deploy.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            View →
          </a>
        </div>
      </div>

      {rollbackRecord !== null && (
        <div className="border-border border-t pt-3">
          <RollbackAuditRow record={rollbackRecord} />
        </div>
      )}

      {correlated.length > 0 && (
        <div className="border-border border-t pt-3">
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
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
                <span className="text-muted-foreground truncate text-xs">
                  {incident.summary}
                </span>
                <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                  {timeAgo(incident.timestamp)}
                </span>
                {incident.issueUrl !== undefined && (
                  <a
                    href={incident.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0 text-[10px] transition-colors"
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

export default async function DeploymentsPage() {
  const [deploys, incidents, liveDeploymentId] = await Promise.all([
    fetchRecentDeployments(20),
    getIncidents(100),
    fetchLiveDeploymentId(),
  ]);

  const rollbackRecords = await Promise.all(
    deploys.map((d) => getRollbackRecord(d.id).catch(() => null)),
  );
  const currentEnv = env.NEXT_PUBLIC_APP_ENV;

  const currentLiveId =
    liveDeploymentId ??
    deploys
      .filter((d) => d.state === "READY")
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.id ??
    null;

  const uniqueActiveIncidentIds = new Set<string>();
  const uniqueAnyIncidentIds = new Set<string>();
  for (const deploy of deploys) {
    const correlated = findCorrelatedIncidents(deploy, incidents);
    for (const incident of correlated) {
      uniqueAnyIncidentIds.add(incident.id);
      if (incident.status === "open" || incident.status === "investigating")
        uniqueActiveIncidentIds.add(incident.id);
    }
  }
  const uniqueActiveIncidentCount = uniqueActiveIncidentIds.size;
  const uniqueResolvedIncidentCount =
    uniqueAnyIncidentIds.size - uniqueActiveIncidentIds.size;
  const deploysWithRollbacks = rollbackRecords.filter((r) => r !== null).length;

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
              Deployments & Rollback
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {deploys.length} recent {currentEnv} deployments · correlated with
              incident history
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border-border bg-muted/40 rounded-xl border p-5">
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
              {currentEnv === "production" ? "Production" : "Preview"}
            </p>
            <p className="text-foreground text-3xl font-bold tabular-nums">
              {deploys.length}
            </p>
          </div>
          <div className="border-border bg-muted/40 rounded-xl border p-5">
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
              Successful
            </p>
            <p className="text-foreground text-3xl font-bold tabular-nums">
              {deploys.filter((d) => d.state === "READY").length}
            </p>
          </div>
          <div
            className={`rounded-xl border p-5 ${uniqueActiveIncidentCount > 0 ? "border-red-500/20 bg-red-500/5" : uniqueAnyIncidentIds.size > 0 ? "border-orange-500/20 bg-orange-500/5" : "border-border bg-muted/40"}`}
          >
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
              Active Incidents
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${uniqueActiveIncidentCount > 0 ? "text-red-400" : uniqueAnyIncidentIds.size > 0 ? "text-orange-400" : "text-foreground"}`}
            >
              {uniqueActiveIncidentCount}
            </p>
            {uniqueResolvedIncidentCount > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                {uniqueResolvedIncidentCount} resolved
              </p>
            )}
            {deploysWithRollbacks > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                {deploysWithRollbacks} rollback
                {deploysWithRollbacks === 1 ? "" : "s"} in window
              </p>
            )}
          </div>
        </div>

        {deploys.length === 0 ? (
          <div className="border-border bg-muted/40 rounded-xl border p-12 text-center">
            <p className="text-muted-foreground">No deployments found.</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Add <code className="font-mono">VERCEL_API_TOKEN</code> and{" "}
              <code className="font-mono">VERCEL_PROJECT_ID</code> to Doppler to
              enable deployment tracking.
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
                isCurrentLive={deploy.id === currentLiveId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
