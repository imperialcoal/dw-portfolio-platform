import { getDeploymentEnvironment } from "./deployment-environment";
import { runtimeEntry } from "./runtime-entry";
import { resolveSecretSource } from "./secret-source";

let booted = false;

export async function ensurePlatformBooted() {
  if (booted) return;

  await runtimeEntry();

  // Validate deployment contract once
  getDeploymentEnvironment();

  const secretSource = resolveSecretSource();

  console.log(
    `🔐 Platform booted | APP_ENV=${process.env.APP_ENV} | Secrets=${secretSource}`,
  );

  booted = true;
}
