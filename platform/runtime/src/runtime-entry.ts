import { loadEnv } from "@dw/env";

import { bootstrapInfra } from "./bootstrap";
import { setupProcessHandlers } from "./process";

let initialized = false;

export async function runtimeEntry() {
  if (initialized) return;
  initialized = true;

  setupProcessHandlers();
  loadEnv();

  if (process.env.NODE_ENV !== "production") {
    await bootstrapInfra();
  }
}
