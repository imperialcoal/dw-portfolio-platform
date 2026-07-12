// Demo trigger logic — constructs synthetic payloads and publishes them
// to the real QStash pipeline. The same agents, same Redis records,
// same dashboard — recruiters see the system actually work end-to-end.
//
// To remove: delete src/demo/ and the api/demo/ routes.

export { buildSyntheticCiPayload } from "./ci-payload";
export { buildSyntheticSentryPayload } from "./sentry-payload";
