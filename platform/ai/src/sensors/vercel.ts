// Sensors only gather raw signals.

import type { VercelDeployment } from "@dw/contracts";
import { config } from "@dw/config";
import { isVercelApiConfigured } from "@dw/validators/observability-env";

/**
 * Maps APP_ENV to the Vercel deployment target value.
 */
function getDeploymentTarget(): "production" | "preview" {
  return config.app.APP_ENV === "production" ? "production" : "preview";
}

/**
 * Raw Vercel API deployment shape.
 * The API returns `uid` as the deployment identifier, not `id`.
 * We map it to `id` in our VercelDeployment contract.
 */
interface VercelApiDeployment {
  uid: string;
  url: string;
  state: string;
  createdAt: number;
  target: "production" | "preview" | null;
  meta: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    githubBranch?: string;
  };
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

export async function getLastProductionDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchDeployments("production", 5);
  return deploys.find((d) => d.state === "READY") ?? null;
}

export async function getLastDeploy(): Promise<VercelDeployment | null> {
  const deploys = await fetchRecentDeployments(5);
  return deploys.find((d) => d.state === "READY") ?? null;
}
