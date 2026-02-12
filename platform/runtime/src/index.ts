export { bootstrapInfra } from "./bootstrap";

export { runtimeDb, runtimeRedis } from "./singletons";

export { createRuntimeContext } from "./context";

export { setupProcessHandlers } from "./process";

export {
  getDeploymentEnvironment,
  isProduction,
  isPreview,
  isLocal,
  isTest,
} from "./deployment-environment";
export type { DeploymentEnvironment } from "./deployment-environment";

export { ensurePlatformBooted } from "./boot-guard";

export * from "./init";

export type { PlatformIdentity } from "./platform-identity";
export { getPlatformIdentity, isProductionPlatform } from "./platform-identity";

export { resolveSecretSource } from "./secret-source";
export type { SecretSource } from "./secret-source";
