import { describe, expect, it } from "vitest";

import {
  getDeploymentEnvironment,
  isLocal,
  isPreview,
  isProduction,
  isTest,
} from "../src/deployment-environment";

describe("Deployment Environment", () => {
  it("throws on invalid APP_ENV", () => {
    process.env.APP_ENV = "staging"; // Invalid
    expect(() => getDeploymentEnvironment()).toThrow(/Invalid APP_ENV/);
  });

  it("validates all valid environments", () => {
    const valid = ["local", "test", "preview", "production"];
    for (const env of valid) {
      process.env.APP_ENV = env;
      expect(getDeploymentEnvironment()).toBe(env);
    }
  });

  it("helper functions return correct booleans", () => {
    process.env.APP_ENV = "production";
    expect(isProduction()).toBe(true);
    expect(isPreview()).toBe(false);
    expect(isLocal()).toBe(false);
    expect(isTest()).toBe(false);
  });
});
