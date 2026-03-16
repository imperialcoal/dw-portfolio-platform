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

export { runtimeEntry } from "./runtime-entry";

export type { PlatformIdentity } from "./platform-identity";
export { getPlatformIdentity, isProductionPlatform } from "./platform-identity";

export { resolveSecretSource } from "./secret-source";
export type { SecretSource } from "./secret-source";

// ─────────────────────────────────────────────
// Execution runtime detection
// ─────────────────────────────────────────────

export {
  getExecutionRuntime,
  isNodeRuntime,
  isEdgeRuntime,
  isBrowserRuntime,
  isTestRuntime,
} from "./execution-runtime";
export type { ExecutionRuntime } from "./execution-runtime";

// ─────────────────────────────────────────────
// Runtime capability guards
// ─────────────────────────────────────────────

export {
  hasTcpSockets,
  hasFilesystem,
  hasLongRunningProcesses,
  hasNodeBuiltins,
  hasWebCrypto,
  hasFetch,
  hasProcessHandlers,
  assertNodeRuntime,
} from "./capabilities";
