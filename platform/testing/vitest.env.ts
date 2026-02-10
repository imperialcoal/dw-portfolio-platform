import { runtimeEntry } from "@dw/runtime/runtime-entry";

await runtimeEntry();

// ensure tests always run in test mode
process.env.NODE_ENV ??= "test";
process.env.APP_ENV ??= "test";
