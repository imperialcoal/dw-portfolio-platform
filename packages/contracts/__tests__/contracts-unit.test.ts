// Pure unit tests for @dw/contracts.
// No database, Redis, or network required — all logic is deterministic.

import { describe, expect, it } from "vitest";

import {
  AnalysisResultSchema,
  INCIDENT_STATUSES,
  IncidentRecordSchema,
  normalizeGitHubWorkflowRun,
  normalizeSecurityAlert,
  normalizeSentryWebhook,
  PlatformEventSchema,
  safeId,
  toIncidentSummary,
} from "@dw/contracts";

// ─────────────────────────────────────────────
// safeId
// ─────────────────────────────────────────────

describe("safeId", () => {
  it("returns string as-is", () => {
    expect(safeId("abc-123")).toBe("abc-123");
  });

  it("converts number to string", () => {
    expect(safeId(42)).toBe("42");
  });

  it("converts bigint to string", () => {
    expect(safeId(BigInt(99))).toBe("99");
  });

  it("returns empty string for undefined", () => {
    expect(safeId(undefined)).toBe("");
  });

  it("returns empty string for null", () => {
    expect(safeId(null)).toBe("");
  });

  it("returns empty string for object", () => {
    expect(safeId({})).toBe("");
  });

  it("returns empty string for array", () => {
    expect(safeId([])).toBe("");
  });
});

// ─────────────────────────────────────────────
// normalizeGitHubWorkflowRun
// ─────────────────────────────────────────────

describe("normalizeGitHubWorkflowRun", () => {
  function makePayload(overrides: Record<string, unknown> = {}) {
    return {
      workflow_run: {
        id: 12345,
        name: "CI",
        head_branch: "dev",
        head_sha: "abc1234567890",
        updated_at: "2026-06-01T12:00:00Z",
        pull_requests: [],
        triggering_actor: { login: "imperialcoal" },
        ...overrides,
      },
      repository: { name: "dw-portfolio-platform" },
    };
  }

  it("returns correct event type", () => {
    const event = normalizeGitHubWorkflowRun(makePayload(), "log output");
    expect(event.type).toBe("ci_failure");
  });

  it("extracts run id", () => {
    const event = normalizeGitHubWorkflowRun(makePayload(), "");
    expect(event.id).toBe("12345");
  });

  it("extracts branch", () => {
    const event = normalizeGitHubWorkflowRun(makePayload(), "");
    expect(event.context.branch).toBe("dev");
  });

  it("truncates commitSha to 7 chars", () => {
    const event = normalizeGitHubWorkflowRun(makePayload(), "");
    expect(event.context.commitSha).toBe("abc1234");
  });

  it("extracts service from repo name", () => {
    const event = normalizeGitHubWorkflowRun(makePayload(), "");
    expect(event.service).toBe("dw-portfolio-platform");
  });

  it("sets triggeredBy from actor login", () => {
    const event = normalizeGitHubWorkflowRun(makePayload(), "");
    expect(event.context.triggeredBy).toBe("imperialcoal");
  });

  it("extracts PR number and title when PR is present", () => {
    const payload = makePayload();
    (payload.workflow_run as Record<string, unknown>).pull_requests = [
      { number: 99, title: "Fix auth bug" },
    ];
    const event = normalizeGitHubWorkflowRun(payload, "");
    expect(event.context.prNumber).toBe(99);
    expect(event.context.prTitle).toBe("Fix auth bug");
  });

  it("sets prNumber and prTitle to null when no PR", () => {
    const event = normalizeGitHubWorkflowRun(makePayload(), "");
    expect(event.context.prNumber).toBeNull();
    expect(event.context.prTitle).toBeNull();
  });

  it("stores job logs in context", () => {
    const logs = "Error: TypeScript compilation failed";
    const event = normalizeGitHubWorkflowRun(makePayload(), logs);
    expect(event.context.jobLogs).toContain("TypeScript compilation failed");
  });

  it("handles missing workflow_run gracefully", () => {
    const event = normalizeGitHubWorkflowRun({}, "");
    expect(event.type).toBe("ci_failure");
    expect(event.id).toBe("");
    expect(event.service).toBe("unknown");
  });
});

// ─────────────────────────────────────────────
// normalizeSentryWebhook
//
// Real source shape (packages/contracts/src/ai/normalize.ts):
//   const data = obj(payload.data);
//   const issue = obj(data.issue ?? payload.issue);
//   const event = obj(data.event);          <- sibling of data.issue, NOT nested in it
//   const request = obj(event.request);
//   route: str(request.url ?? event.transaction, "")
//
// request.url lives at payload.data.event.request.url -- "event" is a
// sibling key under "data", alongside "issue", not a child of "issue".
// An earlier draft nested event/request inside issue, which is why
// "extracts route" failed with null instead of the expected URL.
// ─────────────────────────────────────────────

describe("normalizeSentryWebhook", () => {
  function makePayload(overrides: Record<string, unknown> = {}) {
    return {
      project_slug: "dw-portfolio-preview",
      action: "created",
      data: {
        issue: {
          id: "5551234",
          title: "TypeError: Cannot read property 'id' of undefined",
          culprit: "apps/nextjs/src/app/api/trpc/[trpc]/route.ts",
          firstSeen: "2026-06-01T10:00:00Z",
          userCount: 3,
          permalink: "https://sentry.io/issues/5551234",
        },
        event: {
          environment: "preview",
          culprit: "apps/nextjs/src/app/api/trpc/[trpc]/route.ts",
          request: { url: "/api/trpc/post.all" },
          exception: {
            values: [
              {
                type: "TypeError",
                value: "Cannot read property 'id' of undefined",
                stacktrace: { frames: [] },
              },
            ],
          },
        },
      },
      ...overrides,
    };
  }

  it("returns correct event type", () => {
    const event = normalizeSentryWebhook(makePayload());
    expect(event.type).toBe("sentry_error");
  });

  it("extracts issue id", () => {
    const event = normalizeSentryWebhook(makePayload());
    expect(event.id).toBe("5551234");
  });

  it("extracts service from project_slug", () => {
    const event = normalizeSentryWebhook(makePayload());
    expect(event.service).toBe("dw-portfolio-preview");
  });

  it("extracts title", () => {
    const event = normalizeSentryWebhook(makePayload());
    expect(event.context.title).toContain("TypeError");
  });

  it("extracts route", () => {
    const event = normalizeSentryWebhook(makePayload());
    expect(event.context.route).toBe("/api/trpc/post.all");
  });

  it("extracts userCount", () => {
    const event = normalizeSentryWebhook(makePayload());
    expect(event.context.userCount).toBe(3);
  });

  it("handles empty payload gracefully", () => {
    const event = normalizeSentryWebhook({});
    expect(event.type).toBe("sentry_error");
    expect(event.service).toBe("unknown");
  });
});

// ─────────────────────────────────────────────
// normalizeSecurityAlert
// ─────────────────────────────────────────────

describe("normalizeSecurityAlert", () => {
  function makePayload(overrides: Record<string, unknown> = {}) {
    return {
      action: "created",
      alert: {
        number: 42,
        dependency_scope: "runtime",
        security_advisory: {
          severity: "high",
          ghsa_id: "GHSA-xxxx-yyyy-zzzz",
          summary: "Prototype pollution in lodash",
        },
        security_vulnerability: {
          package: { name: "lodash", ecosystem: "npm" },
          vulnerable_version_range: "< 4.17.21",
          first_patched_version: { identifier: "4.17.21" },
        },
        dependency: { manifest_path: "package.json" },
      },
      repository: { full_name: "imperialcoal/dw-portfolio-platform" },
      ...overrides,
    };
  }

  it("returns correct event type", () => {
    const event = normalizeSecurityAlert(makePayload());
    expect(event.type).toBe("security_alert");
  });

  it("extracts alert number as id", () => {
    const event = normalizeSecurityAlert(makePayload());
    expect(event.id).toBe("42");
  });

  it("extracts package name", () => {
    const event = normalizeSecurityAlert(makePayload());
    expect(event.context.packageName).toBe("lodash");
  });

  it("extracts ecosystem", () => {
    const event = normalizeSecurityAlert(makePayload());
    expect(event.context.ecosystem).toBe("npm");
  });

  it("extracts ghSeverity", () => {
    const event = normalizeSecurityAlert(makePayload());
    expect(event.context.ghSeverity).toBe("high");
  });

  it("extracts firstPatchedVersion", () => {
    const event = normalizeSecurityAlert(makePayload());
    expect(event.context.firstPatchedVersion).toBe("4.17.21");
  });

  it("sets scope to runtime", () => {
    const event = normalizeSecurityAlert(makePayload());
    expect(event.context.scope).toBe("runtime");
  });

  it("sets scope to null for unknown scope", () => {
    const payload = makePayload();
    (payload.alert as Record<string, unknown>).dependency_scope = "unknown";
    const event = normalizeSecurityAlert(payload);
    expect(event.context.scope).toBeNull();
  });

  it("defaults ghSeverity to medium for unknown severity", () => {
    const payload = makePayload();
    (
      (payload.alert as Record<string, unknown>).security_advisory as Record<
        string,
        unknown
      >
    ).severity = "extreme";
    const event = normalizeSecurityAlert(payload);
    expect(event.context.ghSeverity).toBe("medium");
  });

  it("handles empty payload gracefully", () => {
    const event = normalizeSecurityAlert({});
    expect(event.type).toBe("security_alert");
    expect(event.service).toBe("unknown");
  });
});

// ─────────────────────────────────────────────
// Zod schemas — PlatformEventSchema
// ─────────────────────────────────────────────

describe("PlatformEventSchema", () => {
  it("validates a ci_failure event", () => {
    const result = PlatformEventSchema.safeParse({
      type: "ci_failure",
      id: "run-123",
      timestamp: "2026-06-01T12:00:00Z",
      service: "dw-portfolio",
      context: {
        workflow: "CI",
        branch: "dev",
        commitSha: "abc1234",
        prNumber: null,
        prTitle: null,
        jobLogs: "Error: build failed",
        failedStep: "typecheck",
        triggeredBy: "imperialcoal",
      },
    });
    expect(result.success).toBe(true);
  });

  it("validates a sentry_error event", () => {
    const result = PlatformEventSchema.safeParse({
      type: "sentry_error",
      id: "issue-456",
      timestamp: "2026-06-01T12:00:00Z",
      service: "dw-portfolio-preview",
      context: {
        title: "TypeError: undefined",
        culprit: "src/app/page.tsx",
        stacktrace: "at render...",
        route: "/api/trpc",
        environment: "preview",
        userCount: 1,
        firstSeen: "2026-06-01T12:00:00Z",
        issueUrl: "https://sentry.io/issues/456",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an event with unknown type", () => {
    const result = PlatformEventSchema.safeParse({
      type: "unknown_type",
      id: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a ci_failure event missing required fields", () => {
    const result = PlatformEventSchema.safeParse({
      type: "ci_failure",
      id: "run-123",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Zod schemas — AnalysisResultSchema
// ─────────────────────────────────────────────

describe("AnalysisResultSchema", () => {
  it("validates a complete analysis result", () => {
    const result = AnalysisResultSchema.safeParse({
      severity: "high",
      summary: "TypeScript compilation failed",
      rootCause: "Missing type annotation on auth middleware",
      impact: "CI blocked on dev branch",
      suggestedFix: "Add return type to requireAdmin()",
      labels: ["typescript", "auth", "ci"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity", () => {
    const result = AnalysisResultSchema.safeParse({
      severity: "catastrophic",
      summary: "test",
      rootCause: "test",
      impact: "test",
      suggestedFix: "test",
      labels: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-array labels", () => {
    const result = AnalysisResultSchema.safeParse({
      severity: "low",
      summary: "test",
      rootCause: "test",
      impact: "test",
      suggestedFix: "test",
      labels: "typescript,auth",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Zod schemas — IncidentRecordSchema
// ─────────────────────────────────────────────

describe("IncidentRecordSchema", () => {
  const base = {
    type: "ci_failure" as const,
    id: "run-123",
    service: "dw-portfolio",
    timestamp: "2026-06-01T12:00:00Z",
    summary: "CI failed on dev",
    rootCause: "TypeScript error",
    severity: "medium" as const,
    labels: ["ci"],
    status: "open" as const,
    updatedAt: "2026-06-01T12:00:00Z",
  };

  it("validates a minimal valid incident record", () => {
    const result = IncidentRecordSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("validates with optional fields", () => {
    const result = IncidentRecordSchema.safeParse({
      ...base,
      issueUrl:
        "https://github.com/imperialcoal/dw-portfolio-platform/issues/1",
      githubIssueNumber: 1,
      commitSha: "abc1234",
      branch: "dev",
      resolvedAt: "2026-06-01T13:00:00Z",
      resolvedBy: "manual",
      resolutionNote: "Fixed the TypeScript error",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = IncidentRecordSchema.safeParse({
      ...base,
      status: "in_progress",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = IncidentRecordSchema.safeParse({
      ...base,
      type: "uptime_failure",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// incidents.ts — toIncidentSummary, INCIDENT_STATUSES
// ─────────────────────────────────────────────

describe("toIncidentSummary", () => {
  const fullIncident = {
    type: "ci_failure" as const,
    id: "run-123",
    service: "dw-portfolio",
    timestamp: "2026-06-01T12:00:00Z",
    summary: "CI failed on dev",
    rootCause: "TypeScript error",
    severity: "medium" as const,
    labels: ["ci"],
    status: "open" as const,
    updatedAt: "2026-06-01T12:00:00Z",
    issueUrl: "https://github.com/issues/1",
    githubIssueNumber: 1,
  };

  it("returns a subset of the incident fields", () => {
    const summary = toIncidentSummary(fullIncident);
    expect(summary.id).toBe("run-123");
    expect(summary.summary).toBe("CI failed on dev");
    expect(summary.severity).toBe("medium");
    expect(summary.status).toBe("open");
    expect(summary.type).toBe("ci_failure");
  });

  it("does not include rootCause or labels in summary", () => {
    const summary = toIncidentSummary(fullIncident);
    expect("rootCause" in summary).toBe(false);
    expect("labels" in summary).toBe(false);
  });
});

describe("INCIDENT_STATUSES", () => {
  it("contains all expected status values", () => {
    expect(INCIDENT_STATUSES).toContain("open");
    expect(INCIDENT_STATUSES).toContain("investigating");
    expect(INCIDENT_STATUSES).toContain("monitoring");
    expect(INCIDENT_STATUSES).toContain("resolved");
    expect(INCIDENT_STATUSES).toContain("closed");
  });
});
