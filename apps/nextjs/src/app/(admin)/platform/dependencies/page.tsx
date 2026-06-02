import Link from "next/link";

import type { DependencyDashboardData } from "@dw/contracts";
import { getDepAnalysis } from "@dw/ai/memory";
import { fetchDependabotPRs, fetchSecurityAlerts } from "@dw/ai/sensors";

import { DependencyManagerClient } from "./_components/dependency-manager-client";

async function getDepsData(): Promise<DependencyDashboardData> {
  const prs = await fetchDependabotPRs();
  const analyses: DependencyDashboardData["analyses"] = {};
  await Promise.all(
    prs.map(async (pr) => {
      const analysis = await getDepAnalysis(pr.number);
      if (analysis) analyses[pr.number] = analysis;
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
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/platform"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            ← Platform
          </Link>
          <div className="flex-1">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              Dependencies
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {totalPRs} Dependabot {totalPRs === 1 ? "PR" : "PRs"} ·{" "}
              {totalAlerts} security {totalAlerts === 1 ? "alert" : "alerts"}
            </p>
          </div>
        </div>

        {criticalAlerts.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-red-400">
              {criticalAlerts.length} critical or high severity{" "}
              {criticalAlerts.length === 1
                ? "alert requires"
                : "alerts require"}{" "}
              immediate attention
            </p>
          </div>
        )}

        {data === null ? (
          <div className="border-border bg-muted/40 rounded-xl border py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Could not load dependency data.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Check that GITHUB_TOKEN is configured in Doppler.
            </p>
          </div>
        ) : (
          // DependencyManagerClient expects individual props, not a wrapped data object
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
