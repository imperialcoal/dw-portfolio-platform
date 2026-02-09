import { loadEnv } from "@dw/env";

loadEnv();

// ensure tests always run in test mode
process.env.NODE_ENV ??= "test";
process.env.APP_ENV ??= "test";
