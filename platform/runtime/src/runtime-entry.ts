import { loadEnv } from "@dw/env";

import { bootstrapInfra } from "./bootstrap";

let initialized = false;

export async function runtimeEntry() {
  if (initialized) return;
  initialized = true;

  loadEnv();

  if (process.env.NODE_ENV !== "production") {
    await bootstrapInfra();
  }
}
