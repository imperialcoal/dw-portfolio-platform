import "@dw/runtime/init";

// ensure tests always run in test mode
process.env.NODE_ENV ??= "test";
process.env.APP_ENV ??= "test";
