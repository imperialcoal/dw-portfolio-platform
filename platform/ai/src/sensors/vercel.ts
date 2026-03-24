// Sensors only gather raw signals.

import type { VercelDeployment } from "@dw/contracts";
import { config } from "@dw/config";
import { isVercelApiConfigured } from "@dw/validators/observability-env";

/**
 * Maps APP_ENV to the Vercel deployment target value.
 * "production" APP_ENV → filter for target: "production"
 * Everything else (preview, dev, local) → filter for target: "preview"
 */
function getDeploymentTarget(): "production" | "preview" {
  return config.app.APP_ENV === "production" ? "production" : "preview";
}

async function fetchDeployments(
  target: "production" | "preview",
  limit: number,
): Promise<VercelDeployment[]> {
  if (!isVercelApiConfigured()) return [];

  const projectId =
    config.observability.VERCEL_PROJECT_ID ?? "dw-portfolio-platform";

  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${projectId}&target=${target}&limit=${limit}`,
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
 * Fetches recent deployments filtered to the current environment.
 * The preview dashboard only sees preview deployments; production sees production.
 */
export async function fetchRecentDeployments(
  limit = 20,
): Promise<VercelDeployment[]> {
  return fetchDeployments(getDeploymentTarget(), limit);
}

/**
 * Returns the most recent successful production deployment.
 * Always fetches production regardless of current environment —
 * used for the "Last Production Deploy" stat card on the platform overview.
 */
export async function getLastProductionDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchDeployments("production", 5);
  return deploys.find((d) => d.state === "READY") ?? null;
}

/**
 * Returns the most recent successful deployment for the current environment.
 * Used for the deployments page header stat.
 */
export async function getLastDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchRecentDeployments(5);
  return deploys.find((d) => d.state === "READY") ?? null;
}
