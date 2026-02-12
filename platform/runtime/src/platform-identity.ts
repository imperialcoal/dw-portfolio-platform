import type { DeploymentEnvironment } from "./deployment-environment";
import { getDeploymentEnvironment } from "./deployment-environment";

export interface PlatformIdentity {
  appEnv: DeploymentEnvironment;
  nodeEnv: "development" | "test" | "production";
  vercelEnv: "development" | "preview" | "production" | null;
  isCI: boolean;
}

/**
 * Node environment detection
 */
function getNodeEnv(): PlatformIdentity["nodeEnv"] {
  const env = process.env.NODE_ENV;

  if (env === "development" || env === "test" || env === "production") {
    return env;
  }

  return "development";
}

/**
 * Vercel environment detection
 */
function getVercelEnv(): PlatformIdentity["vercelEnv"] {
  const env = process.env.VERCEL_ENV;

  if (env === "development" || env === "preview" || env === "production") {
    return env;
  }

  return null;
}

/**
 * PlatformIdentity factory with APP_ENV ↔ VERCEL_ENV assertion
 */
export function getPlatformIdentity(): PlatformIdentity {
  const appEnv = getDeploymentEnvironment();
  const nodeEnv = getNodeEnv();
  const vercelEnv = getVercelEnv();
  const isCI = process.env.CI === "true";

  // --- CONSISTENCY CHECK ---
  // Only assert if VERCEL_ENV exists
  if (vercelEnv !== null) {
    const mapping: Record<
      "development" | "preview" | "production",
      DeploymentEnvironment
    > = {
      development: "local",
      preview: "preview",
      production: "production",
    };

    const expectedAppEnv = mapping[vercelEnv];

    if (appEnv !== expectedAppEnv) {
      throw new Error(
        `⚠️ APP_ENV (${appEnv}) does not match VERCEL_ENV (${vercelEnv}). ` +
          `Expected APP_ENV=${expectedAppEnv} for VERCEL_ENV=${vercelEnv}. ` +
          `This prevents deploying preview/production code with the wrong APP_ENV.`,
      );
    }
  }

  return { appEnv, nodeEnv, vercelEnv, isCI };
}

export function isProductionPlatform() {
  return getPlatformIdentity().appEnv === "production";
}
