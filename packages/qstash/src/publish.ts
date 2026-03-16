import type { CiJobPayload, SentryJobPayload } from "@dw/contracts/queue";
import { config } from "@dw/config";
import { isQStashConfigured } from "@dw/validators/qstash-env";

import { getQStash } from "./client";

// ─────────────────────────────────────────────
// Target URL resolution
// ─────────────────────────────────────────────

function getProcessorUrl(path: string): string {
  const isProduction = config.app.APP_ENV === "production";
  const base = isProduction
    ? "https://dw-portfolio.dev"
    : "https://dev.dw-portfolio.dev";

  // Append Vercel bypass token for preview deployments so QStash can reach
  // the protected endpoint. Not needed in production.
  const bypassToken =
    config.app.APP_ENV !== "production"
      ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      : undefined;

  const query = bypassToken ? `?x-vercel-protection-bypass=${bypassToken}` : "";
  return `${base}${path}${query}`;
}

// ─────────────────────────────────────────────
// CI job publisher
// ─────────────────────────────────────────────

/**
 * Enqueues a CI failure for agent processing.
 * QStash delivers this to /api/process/ci with retry logic.
 * Deduplication prevents re-processing the same run ID.
 *
 * Returns the QStash message ID for tracing.
 */
export async function publishCiJob(payload: CiJobPayload): Promise<string> {
  if (!isQStashConfigured()) {
    throw new Error(
      "QStash is not configured. Set QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, " +
        "and QSTASH_NEXT_SIGNING_KEY in Doppler to enable job queuing.",
    );
  }

  const client = getQStash();
  const result = await client.publishJSON({
    url: getProcessorUrl("/api/process/ci"),
    body: payload,
    headers: {
      // QStash dedup: won't re-deliver the same run ID within the dedup window.
      // This complements Redis dedup — two independent protection layers.
      "Upstash-Deduplication-Id": `ci-${payload.runId}`,
      // Retry up to 3 times with exponential backoff on non-2xx responses.
      "Upstash-Retries": "3",
    },
  });

  console.log(
    JSON.stringify({
      level: "info",
      qstash: "publish",
      job: "ci",
      runId: payload.runId,
      messageId: result.messageId,
    }),
  );

  return result.messageId;
}

// ─────────────────────────────────────────────
// Sentry job publisher
// ─────────────────────────────────────────────

/**
 * Enqueues a Sentry incident for agent processing.
 * QStash delivers this to /api/process/sentry with retry logic.
 */
export async function publishSentryJob(
  payload: SentryJobPayload,
): Promise<string> {
  if (!isQStashConfigured()) {
    throw new Error(
      "QStash is not configured. Set QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, " +
        "and QSTASH_NEXT_SIGNING_KEY in Doppler to enable job queuing.",
    );
  }

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
