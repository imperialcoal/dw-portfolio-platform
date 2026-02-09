import { db, redis } from "./singletons";

export function createRuntimeContext() {
  return {
    db,
    redis,
    startedAt: Date.now(),
  };
}
