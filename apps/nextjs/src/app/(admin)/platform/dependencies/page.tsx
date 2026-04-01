import Link from "next/link";

import type { DependencyDashboardData } from "@dw/contracts";
import { getDepAnalysis } from "@dw/ai/memory";
import { fetchDependabotPRs, fetchSecurityAlerts } from "@dw/ai/sensors";

import { DependencyManagerClient } from "./_components/dependency-manager-client";

async function getDepsData(): Promise<DependencyDashboardData> {
  const prs = await fetchDependabotPRs();

  // Load cached analyses
  const analyses: DependencyDashboardData["analyses"] = {};
  await Promise.all(
    prs.map(async (pr) => {
      const analysis = await getDepAnalysis(pr.number);
      if (analysis) {
        analyses[pr.number] = analysis;
      }
    }),
  );

  const prsWithAnalysis = prs.map((pr) => ({
    ...pr,
    hasAnalysis: pr.number in analyses,
  }));

  const securityAlerts = await fetchSecurityAlerts(prsWithAnalysis);

  return {
    prs: prsWithAnalysis,
    securityAlerts,
    analyses,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function DependenciesPage() {
  const data = await getDepsData().catch(() => null);

  const criticalAlerts =
    data?.securityAlerts.filter(
      (a) => a.severity === "critical" || a.severity === "high",
    ) ?? [];
  const totalPRs = data?.prs.length ?? 0;
  const totalAlerts = data?.securityAlerts.length ?? 0;

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
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Dependencies
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {totalPRs} Dependabot {totalPRs === 1 ? "PR" : "PRs"} ·{" "}
              {totalAlerts} security {totalAlerts === 1 ? "alert" : "alerts"}
              {criticalAlerts.length > 0 && (
                <span className="text-red-400">
                  {" · "}
                  {criticalAlerts.length} critical/high
                </span>
              )}
            </p>
          </div>
          {data && (
            <p className="text-[10px] text-zinc-700">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {!data ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-zinc-500">Failed to load dependency data.</p>
            <p className="mt-1 text-xs text-zinc-700">
              Ensure GITHUB_TOKEN has{" "}
              <code className="font-mono">pull_requests: read</code> permission.
            </p>
          </div>
        ) : (
          <DependencyManagerClient
            prs={data.prs}
            securityAlerts={data.securityAlerts}
            analyses={data.analyses}
          />
        )}
      </div>
    </div>
  );
}
