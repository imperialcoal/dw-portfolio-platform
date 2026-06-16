// Pure unit tests for @dw/llm.
// No Anthropic API calls — analyzeEvent() is tested via mocking.
// parseAnalysisXml() and all prompt builders are tested directly.
//
// Covers:
//   analyze.ts    — parseAnalysisXml() XML parsing, severity defaults,
//                   label splitting, analyzeEvent() with mocked SDK
//   prompts/      — buildCiFailureUserPrompt, buildSentryIncidentUserPrompt,
//                   buildSecurityAlertUserPrompt — shape and content
//   client.ts     — ANALYSIS_MODEL constant

import { describe, expect, it, vi } from "vitest";

import type {
  CiFailureEvent,
  SecurityAlertEvent,
  SentryErrorEvent,
} from "@dw/contracts";
import {
  ANALYSIS_MODEL,
  buildCiFailureUserPrompt,
  buildSecurityAlertUserPrompt,
  buildSentryIncidentUserPrompt,
  CI_FAILURE_SYSTEM_PROMPT,
  parseAnalysisXml,
  SECURITY_ALERT_SYSTEM_PROMPT,
  SENTRY_INCIDENT_SYSTEM_PROMPT,
} from "@dw/llm";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const ciEvent: CiFailureEvent = {
  type: "ci_failure",
  id: "run-99",
  timestamp: "2026-06-01T12:00:00Z",
  service: "dw-portfolio",
  context: {
    workflow: "CI",
    branch: "dev",
    commitSha: "abc1234",
    prNumber: null,
    prTitle: null,
    jobLogs: "Error: TypeScript compilation failed\n  at src/auth/index.ts:12",
    failedStep: "typecheck",
    triggeredBy: "imperialcoal",
  },
};

const sentryEvent: SentryErrorEvent = {
  type: "sentry_error",
  id: "issue-555",
  timestamp: "2026-06-01T12:00:00Z",
  service: "dw-portfolio-preview",
  context: {
    title: "TypeError: Cannot read properties of undefined",
    culprit: "apps/nextjs/src/app/api/trpc/route.ts",
    stacktrace: "at requireAdmin (require-admin.ts:8)\n  at AdminPage",
    route: "/api/trpc/post.all",
    environment: "preview",
    userCount: 2,
    firstSeen: "2026-06-01T12:00:00Z",
    issueUrl: "https://sentry.io/issues/555",
  },
};

const securityEvent: SecurityAlertEvent = {
  type: "security_alert",
  id: "42",
  timestamp: "2026-06-01T12:00:00Z",
  service: "imperialcoal/dw-portfolio-platform",
  context: {
    alertNumber: 42,
    packageName: "lodash",
    ecosystem: "npm",
    vulnerableVersionRange: "< 4.17.21",
    firstPatchedVersion: "4.17.21",
    ghSeverity: "high",
    cveId: null,
    ghsaId: "GHSA-xxxx-yyyy-zzzz",
    summary: "Prototype pollution in lodash",
    alertUrl: "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz",
    manifestPath: "package.json",
    scope: "runtime",
  },
};

// ─────────────────────────────────────────────
// parseAnalysisXml
// ─────────────────────────────────────────────

describe("parseAnalysisXml", () => {
  it("extracts all fields from well-formed XML", () => {
    const xml = `
      <summary>TypeScript compilation failed on dev branch</summary>
      <root_cause>Missing return type annotation on requireAdmin()</root_cause>
      <impact>CI blocked — no deployments possible</impact>
      <suggested_fix>Add explicit return type to requireAdmin() in require-admin.ts</suggested_fix>
      <severity>high</severity>
      <labels>typescript, auth, ci</labels>
    `;
    const result = parseAnalysisXml(xml);
    expect(result.summary).toBe("TypeScript compilation failed on dev branch");
    expect(result.rootCause).toBe(
      "Missing return type annotation on requireAdmin()",
    );
    expect(result.impact).toBe("CI blocked — no deployments possible");
    expect(result.suggestedFix).toContain("requireAdmin()");
    expect(result.severity).toBe("high");
    expect(result.labels).toEqual(["typescript", "auth", "ci"]);
  });

  it("defaults severity to medium when value is unrecognized", () => {
    const xml = `
      <summary>test</summary>
      <root_cause>test</root_cause>
      <impact>test</impact>
      <suggested_fix>test</suggested_fix>
      <severity>catastrophic</severity>
      <labels></labels>
    `;
    const result = parseAnalysisXml(xml);
    expect(result.severity).toBe("medium");
  });

  it("defaults severity to medium when tag is missing", () => {
    const result = parseAnalysisXml("<summary>test</summary>");
    expect(result.severity).toBe("medium");
  });

  it("accepts all valid severity values", () => {
    for (const sev of ["critical", "high", "medium", "low"] as const) {
      const xml = `<severity>${sev}</severity><summary/><root_cause/><impact/><suggested_fix/><labels/>`;
      expect(parseAnalysisXml(xml).severity).toBe(sev);
    }
  });

  it("returns empty string for missing tags", () => {
    const result = parseAnalysisXml("<severity>low</severity>");
    expect(result.summary).toBe("");
    expect(result.rootCause).toBe("");
    expect(result.impact).toBe("");
    expect(result.suggestedFix).toBe("");
  });

  it("splits labels on comma and trims whitespace", () => {
    const xml = `<labels> typescript ,  auth , ci </labels>`;
    const result = parseAnalysisXml(xml);
    expect(result.labels).toEqual(["typescript", "auth", "ci"]);
  });

  it("returns empty labels array when tag is empty", () => {
    const xml = `<labels></labels>`;
    const result = parseAnalysisXml(xml);
    expect(result.labels).toEqual([]);
  });

  it("handles multiline content inside tags", () => {
    const xml = `<root_cause>
      The auth middleware fails
      when session is null
    </root_cause><summary/><impact/><suggested_fix/><severity>low</severity><labels/>`;
    const result = parseAnalysisXml(xml);
    expect(result.rootCause).toContain("auth middleware fails");
  });

  it("handles empty string input without throwing", () => {
    const result = parseAnalysisXml("");
    expect(result.severity).toBe("medium");
    expect(result.labels).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// buildCiFailureUserPrompt
// ─────────────────────────────────────────────

describe("buildCiFailureUserPrompt", () => {
  it("includes branch in prompt", () => {
    const prompt = buildCiFailureUserPrompt(ciEvent);
    expect(prompt).toContain("dev");
  });

  it("includes workflow name in prompt", () => {
    const prompt = buildCiFailureUserPrompt(ciEvent);
    expect(prompt).toContain("CI");
  });

  it("includes commit sha in prompt", () => {
    const prompt = buildCiFailureUserPrompt(ciEvent);
    expect(prompt).toContain("abc1234");
  });

  it("includes job logs in prompt", () => {
    const prompt = buildCiFailureUserPrompt(ciEvent);
    expect(prompt).toContain("TypeScript compilation failed");
  });

  it("includes failed step in prompt", () => {
    const prompt = buildCiFailureUserPrompt(ciEvent);
    expect(prompt).toContain("typecheck");
  });

  it("returns a non-empty string", () => {
    expect(buildCiFailureUserPrompt(ciEvent).length).toBeGreaterThan(50);
  });

  it("CI_FAILURE_SYSTEM_PROMPT is a non-empty string", () => {
    expect(CI_FAILURE_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });
});

// ─────────────────────────────────────────────
// buildSentryIncidentUserPrompt
// ─────────────────────────────────────────────

describe("buildSentryIncidentUserPrompt", () => {
  it("includes error title in prompt", () => {
    const prompt = buildSentryIncidentUserPrompt(sentryEvent);
    expect(prompt).toContain("TypeError");
  });

  it("includes route in prompt", () => {
    const prompt = buildSentryIncidentUserPrompt(sentryEvent);
    expect(prompt).toContain("/api/trpc/post.all");
  });

  it("includes environment in prompt", () => {
    const prompt = buildSentryIncidentUserPrompt(sentryEvent);
    expect(prompt).toContain("preview");
  });

  it("includes user count in prompt", () => {
    const prompt = buildSentryIncidentUserPrompt(sentryEvent);
    expect(prompt).toContain("2");
  });

  it("returns a non-empty string", () => {
    expect(buildSentryIncidentUserPrompt(sentryEvent).length).toBeGreaterThan(
      50,
    );
  });

  it("SENTRY_INCIDENT_SYSTEM_PROMPT is a non-empty string", () => {
    expect(SENTRY_INCIDENT_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });
});

// ─────────────────────────────────────────────
// buildSecurityAlertUserPrompt
// ─────────────────────────────────────────────

describe("buildSecurityAlertUserPrompt", () => {
  it("includes package name in prompt", () => {
    const prompt = buildSecurityAlertUserPrompt(securityEvent);
    expect(prompt).toContain("lodash");
  });

  it("includes ecosystem in prompt", () => {
    const prompt = buildSecurityAlertUserPrompt(securityEvent);
    expect(prompt).toContain("npm");
  });

  it("includes severity in prompt", () => {
    const prompt = buildSecurityAlertUserPrompt(securityEvent);
    expect(prompt).toContain("high");
  });

  it("includes GHSA id in prompt", () => {
    const prompt = buildSecurityAlertUserPrompt(securityEvent);
    expect(prompt).toContain("GHSA-xxxx-yyyy-zzzz");
  });

  it("includes vulnerable version range in prompt", () => {
    const prompt = buildSecurityAlertUserPrompt(securityEvent);
    expect(prompt).toContain("4.17.21");
  });

  it("returns a non-empty string", () => {
    expect(buildSecurityAlertUserPrompt(securityEvent).length).toBeGreaterThan(
      50,
    );
  });

  it("SECURITY_ALERT_SYSTEM_PROMPT is a non-empty string", () => {
    expect(SECURITY_ALERT_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });
});

// ─────────────────────────────────────────────
// ANALYSIS_MODEL
// ─────────────────────────────────────────────

describe("ANALYSIS_MODEL", () => {
  it("is pinned to claude-sonnet-4-20250514", () => {
    expect(ANALYSIS_MODEL).toBe("claude-sonnet-4-20250514");
  });
});

// ─────────────────────────────────────────────
// analyzeEvent — mocked Anthropic client
// ─────────────────────────────────────────────

describe("analyzeEvent (mocked)", () => {
  it("calls the Anthropic client and parses the response", async () => {
    // Mock the Anthropic client before importing analyzeEvent
    vi.mock("@anthropic-ai/sdk", () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [
              {
                type: "text",
                text: `
                  <summary>TypeScript build failed</summary>
                  <root_cause>Missing type on auth middleware</root_cause>
                  <impact>CI blocked</impact>
                  <suggested_fix>Add return type</suggested_fix>
                  <severity>high</severity>
                  <labels>typescript, ci</labels>
                `,
              },
            ],
          }),
        },
      })),
    }));

    // Set API key so client initializes
    process.env.ANTHROPIC_API_KEY = "sk-test-mock-key";

    const { analyzeEvent } = await import("@dw/llm");
    const result = await analyzeEvent(ciEvent);

    expect(result.summary).toBe("TypeScript build failed");
    expect(result.severity).toBe("high");
    expect(result.labels).toContain("typescript");
  });
});
