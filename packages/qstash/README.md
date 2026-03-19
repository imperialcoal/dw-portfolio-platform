# @dw/qstash

Upstash QStash client wrapper for the platform's durable job queue. Provides type-safe publish functions for all AI agent job types and a request verification function for the Node.js processor routes.

## Purpose

QStash provides reliable, retryable delivery of jobs from the Edge-runtime webhook receivers to the Node.js AI agent processors. This package abstracts the QStash SDK and enforces typed payloads via `@dw/contracts`.

## Architecture

```
src/
├── client.ts    # getQStash() singleton
├── publish.ts   # Typed publish functions per job type
├── verify.ts    # verifyQStashRequest() for processor route validation
└── index.ts     # Re-exports
```

## Key Exports

```typescript
// Publish functions — each returns the QStash messageId
export async function publishCiJob(payload: CiJobPayload): Promise<string>
export async function publishSentryJob(payload: SentryJobPayload): Promise<string>
export async function publishSecurityAlert(payload: SecurityAlertJobPayload): Promise<string>
export async function publishGithubResolution(payload: GithubResolutionPayload): Promise<string>
export async function publishSentryResolution(payload: SentryResolutionPayload): Promise<string>

// Verification — called in processor routes to validate QStash origin
export async function verifyQStashRequest(
  signature: string | null,
  body: string,
): Promise<boolean>
```

### Deduplication Strategy

Each publish function sets an `Upstash-Deduplication-Id` header:

| Job | Dedup ID |
|---|---|
| CI failure | `ci-{runId}` |
| Sentry incident | `sentry-{issueId}` |
| Security alert | `security-{alertId}-{action}` (action included — dismissed must not dedup with created) |
| GitHub resolution | `gh-resolve-{issueNumber}` |
| Sentry resolution | `sentry-resolve-{issueId}` |

### Retry Configuration

All jobs are published with `Upstash-Retries: 3` (CI/Sentry/Security) or `Upstash-Retries: 2` (resolution jobs). Processors return `500` on transient failures to trigger retries, and `400` on validation failures to prevent infinite retries on permanently malformed payloads.

### URL Construction

Processor URLs are constructed based on `APP_ENV`:
- `production` → `https://dw-portfolio.dev/api/process/...`
- all others → `https://dev.dw-portfolio.dev/api/process/...` (with optional Vercel bypass token)

## Configuration

Requires `QSTASH_TOKEN` and `QSTASH_URL`. Call `isQStashConfigured()` from `@dw/validators/qstash-env` before publishing in code paths where QStash may not be configured.

## Dependencies

Consumes: `@dw/config`, `@dw/contracts`, `@dw/validators`

Consumed by: `@dw/nextjs`
