import type {
  CiJobPayload,
  GithubResolutionPayload,
  SecurityAlertJobPayload,
  SentryJobPayload,
  SentryResolutionPayload,
} from "@dw/contracts/queue";
import { config } from "@dw/config";
import { isQStashConfigured } from "@dw/validators/qstash-env";

import { getQStash } from "./client";

function getProcessorUrl(path: string): string {
  const isProduction = config.app.APP_ENV === "production";
  const base = isProduction
    ? "https://dw-portfolio.dev"
    : "https://dev.dw-portfolio.dev";

  const bypassToken =
    config.app.APP_ENV !== "production"
      ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      : undefined;

  const query = bypassToken ? `?x-vercel-protection-bypass=${bypassToken}` : "";
  return `${base}${path}${query}`;
}

function assertQStash(): void {
  if (!isQStashConfigured()) {
    throw new Error(
      "QStash is not configured. Set QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, " +
        "and QSTASH_NEXT_SIGNING_KEY in Doppler to enable job queuing.",
    );
  }
}

// ─────────────────────────────────────────────
// CI dedup key
//
// Dedup on commit SHA + workflow + branch rather than run ID.
//
// Run ID is unique per CI execution — so if the same broken commit
// triggers multiple CI runs (e.g. your push + an agent incident doc
// commit), QStash sees different dedup IDs and processes all of them,
// creating duplicate incidents.
//
// Commit SHA + workflow + branch represents the code state being tested.
// If the same commit fails CI more than once, it's the same failure —
// only the first run should be analyzed.
//
// Falls back to run ID if commit info is unavailable.
// ─────────────────────────────────────────────

function buildCiDedupId(payload: CiJobPayload): string {
  const workflowRun =
    payload.githubPayload.workflow_run !== null &&
    typeof payload.githubPayload.workflow_run === "object"
      ? (payload.githubPayload.workflow_run as Record<string, unknown>)
      : null;

  const commitSha =
    typeof workflowRun?.head_sha === "string"
      ? workflowRun.head_sha.slice(0, 7)
      : payload.runId;

  const workflow =
    typeof workflowRun?.name === "string"
      ? workflowRun.name.replace(/\s+/g, "-").toLowerCase()
      : "ci";

  const branch =
    typeof workflowRun?.head_branch === "string"
      ? workflowRun.head_branch
      : "unknown";

  return `ci-${commitSha}-${workflow}-${branch}`;
}

export async function publishCiJob(payload: CiJobPayload): Promise<string> {
  assertQStash();
  const client = getQStash();
  const dedupId = buildCiDedupId(payload);
  const result = await client.publishJSON({
    url: getProcessorUrl("/api/process/ci"),
    body: payload,
    headers: {
      "Upstash-Deduplication-Id": dedupId,
      "Upstash-Retries": "3",
    },
  });
  console.log(
    JSON.stringify({
      level: "info",
      qstash: "publish",
      job: "ci",
      runId: payload.runId,
      dedupId,
      messageId: result.messageId,
    }),
  );
  return result.messageId;
}

export async function publishSentryJob(
  payload: SentryJobPayload,
): Promise<string> {
  assertQStash();
  const client = getQStash();
  const result = await client.publishJSON({
    url: getProcessorUrl("/api/process/sentry"),
    body: payload,
    headers: {
      "Upstash-Deduplication-Id": `sentry-${payload.issueId}`,
      "Upstash-Retries": "3",
    },
  });
  console.log(
    JSON.stringify({
      level: "info",
      qstash: "publish",
      job: "sentry",
      issueId: payload.issueId,
      messageId: result.messageId,
    }),
  );
  return result.messageId;
}

export async function publishSecurityAlert(
  payload: SecurityAlertJobPayload,
): Promise<string> {
  assertQStash();
  const client = getQStash();
  const result = await client.publishJSON({
    url: getProcessorUrl("/api/process/security"),
    body: payload,
    headers: {
      // Include action in dedup ID — dismissed events must still process
      "Upstash-Deduplication-Id": `security-${payload.alertId}-${payload.action}`,
      "Upstash-Retries": "3",
    },
  });
  console.log(
    JSON.stringify({
      level: "info",
      qstash: "publish",
      job: "security",
      alertId: payload.alertId,
      action: payload.action,
      messageId: result.messageId,
    }),
  );
  return result.messageId;
}

export async function publishGithubResolution(
  payload: GithubResolutionPayload,
): Promise<string> {
  assertQStash();
  const client = getQStash();
  const result = await client.publishJSON({
    url: getProcessorUrl("/api/process/resolve"),
    body: payload,
    headers: {
      "Upstash-Deduplication-Id": `gh-resolve-${payload.issueNumber}`,
      "Upstash-Retries": "2",
    },
  });
  console.log(
    JSON.stringify({
      level: "info",
      qstash: "publish",
      job: "github_resolution",
      issueNumber: payload.issueNumber,
      messageId: result.messageId,
    }),
  );
  return result.messageId;
}

export async function publishSentryResolution(
  payload: SentryResolutionPayload,
): Promise<string> {
  assertQStash();
  const client = getQStash();
  const result = await client.publishJSON({
    url: getProcessorUrl("/api/process/resolve"),
    body: payload,
    headers: {
      "Upstash-Deduplication-Id": `sentry-resolve-${payload.issueId}`,
      "Upstash-Retries": "2",
    },
  });
  console.log(
    JSON.stringify({
      level: "info",
      qstash: "publish",
      job: "sentry_resolution",
      issueId: payload.issueId,
      messageId: result.messageId,
    }),
  );
  return result.messageId;
}
