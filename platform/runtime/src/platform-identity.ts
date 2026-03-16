import type { DeploymentEnvironment } from "./deployment-environment";
import type { ExecutionRuntime } from "./execution-runtime";
import { getDeploymentEnvironment } from "./deployment-environment";
import { getExecutionRuntime } from "./execution-runtime";

export interface PlatformIdentity {
  appEnv: DeploymentEnvironment;
  nodeEnv: "development" | "test" | "production";
  vercelEnv: "development" | "preview" | "production" | null;
  executionRuntime: ExecutionRuntime;
  isCI: boolean;
}

function getNodeEnv(): PlatformIdentity["nodeEnv"] {
  const env = process.env.NODE_ENV;
  if (env === "development" || env === "test" || env === "production") {
    return env;
  }
  return "development";
}

function getVercelEnv(): PlatformIdentity["vercelEnv"] {
  const env = process.env.VERCEL_ENV;
  if (env === "development" || env === "preview" || env === "production") {
    return env;
  }
  return null;
}

/**
 * Returns the full platform identity including deployment environment,
 * Node environment, Vercel environment, execution runtime, and CI status.
 *
 * Validates that APP_ENV and VERCEL_ENV are consistent — prevents
 * deploying preview code with production APP_ENV or vice versa.
 */
export function getPlatformIdentity(): PlatformIdentity {
  const appEnv = getDeploymentEnvironment();
  const nodeEnv = getNodeEnv();
  const vercelEnv = getVercelEnv();
  const executionRuntime = getExecutionRuntime();
  const isCI = process.env.CI === "true" || process.env.CI === "1";

  // ── APP_ENV ↔ VERCEL_ENV consistency check ──────────────────────────────
  // Only assert when VERCEL_ENV is present (i.e. running on Vercel).
  // Local dev and CI don't set VERCEL_ENV.
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

  return { appEnv, nodeEnv, vercelEnv, executionRuntime, isCI };
}

export function isProductionPlatform(): boolean {
  return getPlatformIdentity().appEnv === "production";
}
