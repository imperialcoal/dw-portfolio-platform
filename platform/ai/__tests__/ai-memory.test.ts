// Integration tests for platform/ai memory layer.
// Requires real Upstash Redis via Docker — run via: pnpm test:ai:memory
//
// IMPORTANT — RollbackRecord shape (confirmed via packages/contracts/src/ai/rollback.ts):
// RollbackRecord is FLAT: { deploymentId, rollbackToSha, riskLevel, changes,
// status, initiatedAt, completedAt?, newDeploymentId?, error? }.
// createRollbackRecord(record) takes the full record as ONE argument.
// updateRollbackRecord(deploymentId, patch) — patch is restricted to
// status | completedAt | error | newDeploymentId only.
// There is no commitSha, overallRisk, summary, or createdAt field — those
// names belong to RollbackPreflight, a different interface, not RollbackRecord.
//
// IMPORTANT — BreakingChangeAnalysis shape (confirmed via
// platform/ai/src/sensors/migrations.ts type imports): required fields are
// prNumber, packageName, fromVersion, toVersion, isBreaking, summary,
// breakingChanges, affectedAreas, migrationSteps, recommendation, analyzedAt.
// There is no riskLevel or details field on this type — those were guessed
// incorrectly in an earlier draft.
//
// storeDepAnalysis(analysis) — ONE argument. prNumber is a field on the
// analysis object itself, not a separate parameter.
//
// isDuplicate(type, id) — TWO arguments. type is the dedup category
// ("ci_failure" | "sentry_error"), id is the raw identifier (run id, issue
// id). The Redis key is constructed internally as
// `${type.replace("_", ":")}:${id}` — callers never pass a pre-formatted
// key. Confirmed via platform/ai/src/memory/redis.ts source.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { UserActivityEventType } from "@dw/contracts";
import {
  clearFailedSessions,
  computePercentile,
  createRollbackRecord,
  findIncidentByGithubIssue,
  findIncidentBySecurityAlert,
  findIncidentBySentryIssue,
  getDepAnalysis,
  getEvents,
  getFailedSessionCount,
  getIncident,
  getIncidents,
  getMaintenanceMode,
  getPerfBaseline,
  getRollbackRecord,
  getRollingPerf,
  getSystemHealth,
  getUserActivity,
  incrementFailedSessions,
  isDuplicate,
  logEvent,
  logIncident,
  logUserActivity,
  markIncidentOpen,
  recordPerfSample,
  setMaintenanceMode,
  setPerfBaseline,
  storeDepAnalysis,
  updateIncidentStatus,
  updateRollbackRecord,
} from "@dw/ai/memory";
import { runtimeRedis } from "@dw/runtime/singletons";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeIncident(id: string, overrides: Record<string, unknown> = {}) {
  return {
    type: "ci_failure" as const,
    id,
    service: "dw-portfolio",
    timestamp: new Date().toISOString(),
    summary: `CI failed: ${id}`,
    rootCause: "TypeScript error",
    severity: "medium" as const,
    labels: ["ci", "typescript"],
    ...overrides,
  };
}

async function flushTestKeys() {
  const redis = runtimeRedis();
  const patterns = [
    "platform:incident:*",
    "platform:incidents:index",
    "platform:events",
    "platform:maintenance",
    "platform:user-activity:*",
    "platform:auth:sessions:*",
    "platform:perf:*",
    "ci:failure:*",
    "ci:commit:*",
    "sentry:error:*",
    "deps:analysis:*",
    "rollback:record:*",
  ];
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((k) => redis.del(k)));
    }
  }
}

beforeEach(async () => {
  await flushTestKeys();
});

afterEach(async () => {
  await flushTestKeys();
});

// ─────────────────────────────────────────────
// Incident memory — logIncident / getIncident
// ─────────────────────────────────────────────

describe("logIncident / getIncident", () => {
  it("stores and retrieves an incident by id", async () => {
    await logIncident(makeIncident("run-001"));
    const incident = await getIncident("run-001");
    expect(incident).not.toBeNull();
    expect(incident?.id).toBe("run-001");
    expect(incident?.summary).toBe("CI failed: run-001");
  });

  it("stores all required fields", async () => {
    await logIncident(makeIncident("run-002", { severity: "critical" }));
    const incident = await getIncident("run-002");
    expect(incident?.severity).toBe("critical");
    expect(incident?.type).toBe("ci_failure");
    expect(incident?.labels).toContain("ci");
  });

  it("returns null for non-existent incident", async () => {
    const incident = await getIncident("nonexistent-id");
    expect(incident).toBeNull();
  });

  it("overwrites existing incident on re-log (upsert)", async () => {
    await logIncident(makeIncident("run-003", { summary: "First log" }));
    await logIncident(makeIncident("run-003", { summary: "Updated log" }));
    const incident = await getIncident("run-003");
    expect(incident?.summary).toBe("Updated log");
  });
});

// ─────────────────────────────────────────────
// Incident memory — getIncidents
// ─────────────────────────────────────────────

describe("getIncidents", () => {
  it("returns empty array when no incidents", async () => {
    const incidents = await getIncidents(10);
    expect(incidents).toEqual([]);
  });

  it("returns all logged incidents", async () => {
    await logIncident(makeIncident("run-010"));
    await logIncident(makeIncident("run-011"));
    await logIncident(makeIncident("run-012"));
    const incidents = await getIncidents(10);
    expect(incidents.length).toBe(3);
  });

  it("respects limit parameter", async () => {
    await logIncident(makeIncident("run-020"));
    await logIncident(makeIncident("run-021"));
    await logIncident(makeIncident("run-022"));
    const incidents = await getIncidents(2);
    expect(incidents.length).toBeLessThanOrEqual(2);
  });

  it("returns newest incidents first", async () => {
    await logIncident(makeIncident("run-030"));
    await logIncident(makeIncident("run-031"));
    const incidents = await getIncidents(10);
    expect(incidents[0]?.id).toBe("run-031");
  });
});

// ─────────────────────────────────────────────
// markIncidentOpen / updateIncidentStatus
// ─────────────────────────────────────────────

describe("markIncidentOpen / updateIncidentStatus", () => {
  it("marks incident as open", async () => {
    await logIncident(makeIncident("run-040"));
    await markIncidentOpen("run-040");
    const incident = await getIncident("run-040");
    expect(incident?.status).toBe("open");
  });

  it("transitions open -> investigating", async () => {
    await logIncident(makeIncident("run-041"));
    await markIncidentOpen("run-041");
    await updateIncidentStatus("run-041", "investigating");
    const incident = await getIncident("run-041");
    expect(incident?.status).toBe("investigating");
  });

  it("transitions investigating -> monitoring", async () => {
    await logIncident(makeIncident("run-042"));
    await markIncidentOpen("run-042");
    await updateIncidentStatus("run-042", "monitoring");
    const incident = await getIncident("run-042");
    expect(incident?.status).toBe("monitoring");
  });

  it("transitions to resolved with resolvedBy and note", async () => {
    await logIncident(makeIncident("run-043"));
    await markIncidentOpen("run-043");
    await updateIncidentStatus("run-043", "resolved", {
      resolvedBy: "manual",
      resolutionNote: "Fixed the TypeScript error",
    });
    const incident = await getIncident("run-043");
    expect(incident?.status).toBe("resolved");
    expect(incident?.resolvedBy).toBe("manual");
    expect(incident?.resolutionNote).toBe("Fixed the TypeScript error");
    expect(incident?.resolvedAt).toBeDefined();
  });

  it("noop on updateIncidentStatus for non-existent id", async () => {
    await expect(
      updateIncidentStatus("nonexistent", "resolved"),
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────
// isDuplicate
// ─────────────────────────────────────────────

describe("isDuplicate", () => {
  it("returns false on first encounter", async () => {
    const dup = await isDuplicate("ci_failure", "run-050");
    expect(dup).toBe(false);
  });

  it("returns true on second encounter within TTL", async () => {
    await isDuplicate("ci_failure", "run-051");
    const dup = await isDuplicate("ci_failure", "run-051");
    expect(dup).toBe(true);
  });

  it("different ids do not collide", async () => {
    await isDuplicate("ci_failure", "run-060");
    const dup = await isDuplicate("ci_failure", "run-061");
    expect(dup).toBe(false);
  });

  it("different event types with the same id do not collide", async () => {
    await isDuplicate("ci_failure", "shared-id-001");
    const dup = await isDuplicate("sentry_error", "shared-id-001");
    expect(dup).toBe(false);
  });
});

// ─────────────────────────────────────────────
// findIncidentBy* lookups
// ─────────────────────────────────────────────

describe("findIncidentByGithubIssue", () => {
  it("finds incident by github issue number", async () => {
    await logIncident(makeIncident("run-070", { githubIssueNumber: 42 }));
    const incident = await findIncidentByGithubIssue(42);
    expect(incident?.id).toBe("run-070");
  });

  it("returns null when no match", async () => {
    const incident = await findIncidentByGithubIssue(9999);
    expect(incident).toBeNull();
  });
});

describe("findIncidentBySentryIssue", () => {
  it("finds incident by sentry issue id", async () => {
    await logIncident(
      makeIncident("sentry-080", {
        type: "sentry_error",
        sentryIssueId: "sentry-issue-abc",
      }),
    );
    const incident = await findIncidentBySentryIssue("sentry-issue-abc");
    expect(incident?.id).toBe("sentry-080");
  });

  it("returns null when no match", async () => {
    const incident = await findIncidentBySentryIssue("nonexistent-sentry");
    expect(incident).toBeNull();
  });
});

describe("findIncidentBySecurityAlert", () => {
  it("finds incident by security alert id (stored as sentryIssueId)", async () => {
    await logIncident(
      makeIncident("security-090", {
        type: "security_alert",
        sentryIssueId: "alert-42",
      }),
    );
    const incident = await findIncidentBySecurityAlert("alert-42");
    expect(incident?.id).toBe("security-090");
  });

  it("returns null when no match", async () => {
    const incident = await findIncidentBySecurityAlert("nonexistent-alert");
    expect(incident).toBeNull();
  });
});

// ─────────────────────────────────────────────
// logEvent / getEvents
// ─────────────────────────────────────────────

describe("logEvent / getEvents", () => {
  const event = {
    type: "ci_failure" as const,
    id: "run-100",
    timestamp: new Date().toISOString(),
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
  };

  it("stores and retrieves events", async () => {
    await logEvent(event);
    const events = await getEvents(10);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array when no events", async () => {
    const events = await getEvents(10);
    expect(events).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// getSystemHealth
// ─────────────────────────────────────────────

describe("getSystemHealth", () => {
  it("returns healthy when no incidents", async () => {
    const health = await getSystemHealth();
    expect(health.recentSeverity).toBe("healthy");
  });

  it("reflects critical incident in health", async () => {
    await logIncident(makeIncident("run-110", { severity: "critical" }));
    await markIncidentOpen("run-110");
    const health = await getSystemHealth();
    expect(health.recentSeverity).toBe("critical");
  });

  it("reflects medium severity when only medium incidents are open", async () => {
    await logIncident(makeIncident("run-111", { severity: "medium" }));
    await markIncidentOpen("run-111");
    const health = await getSystemHealth();
    expect(["medium", "high", "critical"]).toContain(health.recentSeverity);
  });

  it("returns healthy after all incidents are resolved", async () => {
    await logIncident(makeIncident("run-112", { severity: "high" }));
    await markIncidentOpen("run-112");
    await updateIncidentStatus("run-112", "resolved", {
      resolvedBy: "manual",
    });
    const health = await getSystemHealth();
    expect(health.recentSeverity).toBe("healthy");
  });
});

// ─────────────────────────────────────────────
// storeDepAnalysis / getDepAnalysis
// ─────────────────────────────────────────────

describe("storeDepAnalysis / getDepAnalysis", () => {
  const analysis = {
    prNumber: 55,
    packageName: "lodash",
    fromVersion: "4.17.20",
    toVersion: "4.17.21",
    isBreaking: true,
    summary: "Minor breaking change in deep clone behavior",
    breakingChanges: ["Renamed internal _cloneDeep helper signature"],
    affectedAreas: ["platform/ai/src/sensors/migrations.ts"],
    migrationSteps: ["Update any direct imports of the renamed helper"],
    recommendation: "review-required" as const,
    analyzedAt: new Date().toISOString(),
  };

  it("stores and retrieves dep analysis", async () => {
    await storeDepAnalysis(analysis);
    const result = await getDepAnalysis(55);
    expect(result).not.toBeNull();
    expect(result?.prNumber).toBe(55);
    expect(result?.isBreaking).toBe(true);
  });

  it("returns null for non-existent PR", async () => {
    const result = await getDepAnalysis(9999);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────
// createRollbackRecord / updateRollbackRecord / getRollbackRecord
// ─────────────────────────────────────────────

describe("Rollback records", () => {
  function makeRollbackRecord(overrides: Record<string, unknown> = {}) {
    return {
      deploymentId: "deploy-abc123",
      rollbackToSha: "abc1234",
      riskLevel: "safe" as const,
      changes: [] as string[],
      status: "pending" as const,
      initiatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("creates and retrieves a rollback record", async () => {
    await createRollbackRecord(makeRollbackRecord());
    const record = await getRollbackRecord("deploy-abc123");
    expect(record).not.toBeNull();
    expect(record?.deploymentId).toBe("deploy-abc123");
    expect(record?.status).toBe("pending");
  });

  it("updates rollback record with status and newDeploymentId", async () => {
    await createRollbackRecord(makeRollbackRecord());
    await updateRollbackRecord("deploy-abc123", {
      status: "success",
      newDeploymentId: "deploy-xyz789",
      completedAt: new Date().toISOString(),
    });
    const record = await getRollbackRecord("deploy-abc123");
    expect(record?.status).toBe("success");
    expect(record?.newDeploymentId).toBe("deploy-xyz789");
    expect(record?.completedAt).toBeDefined();
  });

  it("updates rollback record with error on failure", async () => {
    await createRollbackRecord(makeRollbackRecord());
    await updateRollbackRecord("deploy-abc123", {
      status: "failed",
      error: "Vercel promote API timed out",
    });
    const record = await getRollbackRecord("deploy-abc123");
    expect(record?.status).toBe("failed");
    expect(record?.error).toBe("Vercel promote API timed out");
  });

  it("preserves riskLevel and changes from creation through updates", async () => {
    await createRollbackRecord(
      makeRollbackRecord({
        riskLevel: "risky",
        changes: ["ALTER TABLE post ADD COLUMN draft boolean"],
      }),
    );
    await updateRollbackRecord("deploy-abc123", { status: "executing" });
    const record = await getRollbackRecord("deploy-abc123");
    expect(record?.riskLevel).toBe("risky");
    expect(record?.changes).toContain(
      "ALTER TABLE post ADD COLUMN draft boolean",
    );
  });

  it("returns null for non-existent deployment", async () => {
    const record = await getRollbackRecord("nonexistent-deploy");
    expect(record).toBeNull();
  });

  it("noop on updateRollbackRecord for non-existent deployment", async () => {
    await expect(
      updateRollbackRecord("nonexistent-deploy", { status: "failed" }),
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────
// Maintenance mode
// ─────────────────────────────────────────────

describe("getMaintenanceMode / setMaintenanceMode", () => {
  it("returns null when maintenance is not set", async () => {
    const mode = await getMaintenanceMode();
    expect(mode).toBeNull();
  });

  it("sets and retrieves maintenance mode when enabled", async () => {
    await setMaintenanceMode({
      enabled: true,
      message: "Scheduled maintenance -- back in 10 minutes",
      enabledAt: new Date().toISOString(),
      enabledBy: "admin",
    });
    const mode = await getMaintenanceMode();
    expect(mode).not.toBeNull();
    expect(mode?.enabled).toBe(true);
    expect(mode?.message).toContain("Scheduled maintenance");
  });

  it("returns null when maintenance is disabled", async () => {
    await setMaintenanceMode({
      enabled: false,
      message: "",
      enabledAt: new Date().toISOString(),
      enabledBy: "admin",
    });
    const mode = await getMaintenanceMode();
    expect(mode).toBeNull();
  });
});

// ─────────────────────────────────────────────
// User activity
// ─────────────────────────────────────────────

describe("logUserActivity / getUserActivity", () => {
  function makeActivity(
    id: string,
    eventType: UserActivityEventType = "user.created",
  ) {
    return {
      id,
      eventType,
      userId: `user_${id}`,
      userEmail: `${id}@test.com`,
      userName: "Test User",
      timestamp: new Date().toISOString(),
      metadata: { isOwner: false },
    };
  }

  it("stores and retrieves user activity", async () => {
    await logUserActivity(makeActivity("act-001"));
    const activity = await getUserActivity(10);
    expect(activity.length).toBeGreaterThanOrEqual(1);
    expect(activity.some((a) => a.id === "act-001")).toBe(true);
  });

  it("returns empty array when no activity", async () => {
    const activity = await getUserActivity(10);
    expect(activity).toEqual([]);
  });

  it("respects limit parameter", async () => {
    await logUserActivity(makeActivity("act-010"));
    await logUserActivity(makeActivity("act-011"));
    await logUserActivity(makeActivity("act-012"));
    const activity = await getUserActivity(2);
    expect(activity.length).toBeLessThanOrEqual(2);
  });

  it("stores session events", async () => {
    await logUserActivity(makeActivity("act-020", "session.created"));
    const activity = await getUserActivity(10);
    const found = activity.find((a) => a.id === "act-020");
    expect(found?.eventType).toBe("session.created");
  });
});

describe("incrementFailedSessions / getFailedSessionCount / clearFailedSessions", () => {
  it("increments failed session count", async () => {
    const count1 = await incrementFailedSessions("user_fail_001");
    const count2 = await incrementFailedSessions("user_fail_001");
    expect(count2).toBe(count1 + 1);
  });

  it("getFailedSessionCount returns 0 when no failures", async () => {
    const count = await getFailedSessionCount("user_no_fails");
    expect(count).toBe(0);
  });

  it("clearFailedSessions resets count to 0", async () => {
    await incrementFailedSessions("user_fail_002");
    await incrementFailedSessions("user_fail_002");
    await clearFailedSessions("user_fail_002");
    const count = await getFailedSessionCount("user_fail_002");
    expect(count).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Performance baselines
// ─────────────────────────────────────────────

describe("recordPerfSample / getRollingPerf / setPerfBaseline / getPerfBaseline", () => {
  it("records and retrieves perf samples", async () => {
    await recordPerfSample("/api/trpc/post.all", 120);
    await recordPerfSample("/api/trpc/post.all", 180);
    const samples = await getRollingPerf("/api/trpc/post.all", 10);
    expect(samples.length).toBe(2);
    expect(samples).toContain(120);
    expect(samples).toContain(180);
  });

  it("stores and retrieves perf baseline", async () => {
    const baseline = {
      route: "/api/trpc/post.all",
      p50Ms: 120,
      p95Ms: 350,
      sampleCount: 50,
      capturedAt: new Date().toISOString(),
    };
    await setPerfBaseline(baseline);
    const result = await getPerfBaseline("/api/trpc/post.all");
    expect(result).not.toBeNull();
    expect(result?.p50Ms).toBe(120);
    expect(result?.p95Ms).toBe(350);
  });

  it("returns null for route with no baseline", async () => {
    const result = await getPerfBaseline("/no/baseline/here");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────
// computePercentile (pure function -- no Redis)
// ─────────────────────────────────────────────

describe("computePercentile", () => {
  it("returns 0 for empty array", () => {
    expect(computePercentile([], 50)).toBe(0);
  });

  it("computes P50 of sorted array", () => {
    const sorted = [100, 200, 300, 400, 500];
    expect(computePercentile(sorted, 50)).toBe(300);
  });

  it("computes P95 of sorted array", () => {
    const sorted = [
      100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240,
      250, 260, 270, 280, 500,
    ];
    const p95 = computePercentile(sorted, 95);
    expect(p95).toBe(500);
  });

  it("returns single element for single-element array", () => {
    expect(computePercentile([42], 50)).toBe(42);
    expect(computePercentile([42], 95)).toBe(42);
  });

  it("P100 returns last element", () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(computePercentile(sorted, 100)).toBe(5);
  });
});
