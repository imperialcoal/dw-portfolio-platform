import { describe, expect, it } from "vitest";

import { resolveSecretSource } from "../src/secret-source";
import { cleanEnv } from "./helpers";

describe("Secret Source Resolution", () => {
  cleanEnv();

  it("Uses terraform-env when in CI (Priority 1)", () => {
    process.env.APP_ENV = "test";
    process.env.CI = "true";
    delete process.env.VERCEL_ENV;

    expect(resolveSecretSource()).toBe("terraform-env");
  });

  it("Uses vercel-env when deployed to Vercel (Priority 2)", () => {
    process.env.APP_ENV = "production";
    process.env.VERCEL_ENV = "production";
    delete process.env.CI;

    expect(resolveSecretSource()).toBe("vercel-env");
  });

  it("Uses local-env for standard development (Priority 3)", () => {
    process.env.APP_ENV = "local";
    delete process.env.VERCEL_ENV;
    delete process.env.CI;

    expect(resolveSecretSource()).toBe("local-env");
  });
});
