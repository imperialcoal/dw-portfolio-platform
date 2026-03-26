import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type {
  DependencyDashboardData,
  SecurityAlertWithPR,
} from "@dw/contracts";
import { getDepAnalysis, getIncidents } from "@dw/ai/memory";
import { fetchDependabotPRs } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/platform/deps
 *
 * Returns all dependency management data:
 * - Open Dependabot PRs with parsed metadata
 * - Security alert incidents with correlation to fix PRs
 * - Cached breaking change analyses
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [prs, incidents] = await Promise.all([
    fetchDependabotPRs(),
    getIncidents(100),
  ]);

  // Load cached analyses for all PRs
  const analyses: DependencyDashboardData["analyses"] = {};
  await Promise.all(
    prs.map(async (pr) => {
      const analysis = await getDepAnalysis(pr.number);
      if (analysis) {
        analyses[pr.number] = analysis;
      }
    }),
  );

  // Mark PRs that have analyses
  const prsWithAnalysis = prs.map((pr) => ({
    ...pr,
    hasAnalysis: pr.number in analyses,
  }));

  // Build security alert list from Redis incidents
  const securityIncidents = incidents.filter(
    (i) => i.type === "security_alert",
  );

  const securityAlerts: SecurityAlertWithPR[] = securityIncidents.map(
    (incident) => {
      const fixPR =
        prsWithAnalysis.find((pr) =>
          incident.labels.some(
            (l) =>
              l.toLowerCase() === pr.packageName.toLowerCase() ||
              pr.packageName.toLowerCase().includes(l.toLowerCase()),
          ),
        ) ?? null;

      const cveLabel = incident.labels.find(
        (l) => l.startsWith("CVE-") || l.startsWith("GHSA-"),
      );
      const ecosystemLabel = incident.labels.find((l) =>
        ["npm", "pip", "cargo", "maven", "nuget"].includes(l.toLowerCase()),
      );
      const severityLabel = incident.labels.find((l) =>
        ["critical", "high", "medium", "low"].includes(l.toLowerCase()),
      );

      return {
        alertId: incident.sentryIssueId ?? incident.id,
        packageName:
          incident.labels.find(
            (l) =>
              !l.startsWith("severity:") &&
              l !== "security" &&
              l !== "dependabot",
          ) ?? "unknown",
        ecosystem: ecosystemLabel ?? "npm",
        severity: (severityLabel ?? incident.severity) as
          | "low"
          | "medium"
          | "high"
          | "critical",
        identifier: cveLabel ?? incident.id,
        summary: incident.summary,
        vulnerableRange: "",
        fixedVersion: null,
        fixPR,
        noFixAvailable: fixPR === null,
        alertUrl: incident.issueUrl ?? "",
        incidentId: incident.id,
      };
    },
  );

  const data: DependencyDashboardData = {
    prs: prsWithAnalysis,
    securityAlerts,
    analyses,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
