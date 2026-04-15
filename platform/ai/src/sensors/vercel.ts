// Sensors only gather raw signals.

import type { VercelApiDeployment, VercelDeployment } from "@dw/contracts";
import { config } from "@dw/config";
import { isVercelApiConfigured } from "@dw/validators/observability-env";

/**
 * Maps APP_ENV to the Vercel deployment target value.
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

  const data = (await res.json()) as { deployments: VercelApiDeployment[] };

  // Map uid → id so VercelDeployment.id is always populated
  return data.deployments.map((d) => ({
    id: d.uid,
    url: d.url,
    state: d.state,
    createdAt: d.createdAt,
    target: d.target,
    meta: d.meta,
  }));
}

export async function fetchRecentDeployments(
  limit = 20,
): Promise<VercelDeployment[]> {
  return fetchDeployments(getDeploymentTarget(), limit);
}

/**
 * Returns the deployment uid that the branch alias currently points at.
 *
 * After a rollback the alias points at an older deployment, so the most
 * recently-created READY deployment is no longer "live". This function
 * asks the Vercel Aliases API for the ground truth.
 *
 * Falls back to null on any error — callers should degrade gracefully.
 */
export async function fetchLiveDeploymentId(): Promise<string | null> {
  if (!isVercelApiConfigured()) return null;

  const alias =
    config.observability.VERCEL_DOMAIN ??
    (config.app.APP_ENV === "production"
      ? "dw-portfolio.dev"
      : "dev.dw-portfolio.dev");

  const teamId = config.observability.VERCEL_TEAM_ID;
  const url = new URL(
    `https://api.vercel.com/v4/aliases/${encodeURIComponent(alias)}`,
  );
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${String(config.observability.VERCEL_API_TOKEN)}`,
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      deploymentId?: string;
      deployment?: { id?: string };
    };
    // Vercel returns either deploymentId directly or nested under deployment.id
    return data.deploymentId ?? data.deployment?.id ?? null;
  } catch {
    return null;
  }
}

export async function getLastProductionDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchDeployments("production", 5);
  return deploys.find((d) => d.state === "READY") ?? null;
}

export async function getLastDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchRecentDeployments(5);
  return deploys.find((d) => d.state === "READY") ?? null;
}
