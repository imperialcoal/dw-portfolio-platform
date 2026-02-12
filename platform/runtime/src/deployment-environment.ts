export const DEPLOYMENT_ENVIRONMENTS = [
  "local",
  "test",
  "preview",
  "production",
] as const;

export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

function isDeploymentEnvironment(
  value: unknown,
): value is DeploymentEnvironment {
  return (
    typeof value === "string" &&
    (DEPLOYMENT_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

export function getDeploymentEnvironment(): DeploymentEnvironment {
  const env = process.env.APP_ENV;

  if (!isDeploymentEnvironment(env)) {
    throw new Error(
      `Invalid APP_ENV: ${env}. Must be one of ${DEPLOYMENT_ENVIRONMENTS.join(", ")}`,
    );
  }

  return env;
}

export function isProduction() {
  return getDeploymentEnvironment() === "production";
}

export function isPreview() {
  return getDeploymentEnvironment() === "preview";
}

export function isLocal() {
  return getDeploymentEnvironment() === "local";
}

export function isTest() {
  return getDeploymentEnvironment() === "test";
}
