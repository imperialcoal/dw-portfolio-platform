import { describe, expect, it } from "vitest";

import { getPlatformIdentity } from "../src/platform-identity";
import { cleanEnv } from "./helpers";

describe("Platform Identity Guardrails", () => {
  cleanEnv();

  describe("Valid Configurations", () => {
    it("identifies Local Development correctly", () => {
      process.env.APP_ENV = "local";
      process.env.NODE_ENV = "development";

      const identity = getPlatformIdentity();
      expect(identity.appEnv).toBe("local");
      expect(identity.vercelEnv).toBeNull();
      expect(identity.isCI).toBe(false);
    });

    it("identifies Vercel Production correctly", () => {
      process.env.APP_ENV = "production";
      process.env.NODE_ENV = "production";
      process.env.VERCEL_ENV = "production";

      const identity = getPlatformIdentity();
      expect(identity.appEnv).toBe("production");
      expect(identity.vercelEnv).toBe("production");
    });

    it("identifies CI correctly", () => {
      process.env.APP_ENV = "test";
      process.env.CI = "true";

      const identity = getPlatformIdentity();
      expect(identity.isCI).toBe(true);
    });
  });

  describe("Security & Safety Guardrails", () => {
    it("THROWS when Vercel Env contradicts App Env (The Deployment Guard)", () => {
      // SCENARIO: Accidental misconfiguration where we deploy code meant
      // for 'local' into a 'production' Vercel slot.
      process.env.APP_ENV = "local";
      process.env.VERCEL_ENV = "production";

      expect(() => getPlatformIdentity()).toThrowError(
        /does not match VERCEL_ENV/,
      );
    });

    it("THROWS when Vercel Env is Preview but App Env is Production", () => {
      process.env.APP_ENV = "production";
      process.env.VERCEL_ENV = "preview";

      expect(() => getPlatformIdentity()).toThrowError(
        /does not match VERCEL_ENV/,
      );
    });

    it("Defaults NODE_ENV to development if undefined", () => {
      process.env.APP_ENV = "local";
      delete process.env.NODE_ENV;

      const identity = getPlatformIdentity();
      expect(identity.nodeEnv).toBe("development");
    });
  });
});
