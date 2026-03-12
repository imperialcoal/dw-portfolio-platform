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

/**
 * Fetches recent deployments from Vercel API, filtered to the current
 * environment. The preview dashboard at dev.dw-portfolio.dev only sees
 * preview deployments; the production dashboard only sees production ones.
 *
 * Returns empty array if VERCEL_API_TOKEN is not configured.
 */
export async function fetchRecentDeployments(
  limit = 20,
): Promise<VercelDeployment[]> {
  if (!isVercelApiConfigured()) return [];

  const projectId =
    config.observability.VERCEL_PROJECT_ID ?? "dw-portfolio-platform";
  const target = getDeploymentTarget();

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
 * Returns the most recent deployment for the current environment.
 */
export async function getLastProductionDeploy(): Promise<VercelDeployment | null> {
  if (!isVercelApiConfigured()) return null;

  const projectId =
    config.observability.VERCEL_PROJECT_ID ?? "dw-portfolio-platform";

  // Always fetch the true production deployment for the stat card —
  // used on the platform overview page regardless of current env.
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&limit=5`,
    {
      headers: {
        Authorization: `Bearer ${String(config.observability.VERCEL_API_TOKEN)}`,
      },
    },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as { deployments: VercelDeployment[] };
  return data.deployments.find((d) => d.state === "READY") ?? null;
}

/**
 * Returns the most recent deployment for the current environment.
 * Used on the deployments page header stat.
 */
export async function getLastDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchRecentDeployments(5);
  return deploys.find((d) => d.state === "READY") ?? null;
}
