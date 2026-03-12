// Sensors only gather raw signals.

import type { VercelDeployment } from "@dw/contracts";
import { config } from "@dw/config";
import { isVercelApiConfigured } from "@dw/validators/observability-env";

/**
 * Fetches recent deployments for the portfolio project from Vercel API.
 * Returns an empty array if VERCEL_API_TOKEN is not configured — the
 * deployments dashboard page shows an empty state rather than crashing.
 */
export async function fetchRecentDeployments(
  limit = 5,
): Promise<VercelDeployment[]> {
  if (!isVercelApiConfigured()) return [];

  const projectId =
    config.observability.VERCEL_PROJECT_ID ?? "dw-portfolio-platform";

  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${String(config.observability.VERCEL_API_TOKEN)}`,
      },
    },
  );

  if (!res.ok) return [];

  const data = (await res.json()) as { deployments: VercelDeployment[] };
  return data.deployments;
}

/**
 * Returns the most recent production deployment, or null if Vercel is not
 * configured or no production deployment exists.
 */
export async function getLastProductionDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchRecentDeployments(10);
  return (
    deploys.find((d) => d.target === "production" && d.state === "READY") ??
    null
  );
}
