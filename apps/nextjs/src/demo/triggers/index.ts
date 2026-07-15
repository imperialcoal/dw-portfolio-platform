// Demo trigger logic — constructs a synthetic payload and publishes it
// to the real QStash pipeline. The same agents, same Redis records,
// same dashboard — recruiters see the system actually work end-to-end.
//
// To remove: delete src/demo/ and the api/demo/ routes.

export { buildSyntheticCiPayload } from "./ci-payload";
