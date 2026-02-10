import { runtimeDb, runtimeRedis } from "./singletons";

export function createRuntimeContext() {
  return {
    db: runtimeDb(),
    redis: runtimeRedis(),
  };
}
