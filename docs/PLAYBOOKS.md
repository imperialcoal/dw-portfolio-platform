# Playbooks

Runbooks for common operational tasks, incident response, and failure recovery.

---

## Incident Response Checklist

When an alert fires or a user reports an issue, follow this sequence:

1. **Check the platform dashboard** at `/platform/incidents` — determine if the platform agent has already detected and classified the incident.
2. **Check Sentry** for the relevant project (`dw-portfolio-production` or `dw-portfolio-preview`) for error details and stack traces.
3. **Check Vercel Functions logs** for the route that is failing — structured JSON logs from AI agents and processors are visible here.
4. **Check the GitHub Issues list** for any issues labeled `platform-agent` that were auto-created.
5. **Assess severity** using the incident record's `severity` field (`critical` / `high` / `medium` / `low`) and `status` (`investigating` / `open` / `monitoring`).
6. **Escalate or resolve** — follow the relevant playbook below based on the failure mode.

---

## Common Failure Scenarios

### 1. AI Agent Not Running on CI Failures

**Symptoms:**
- CI workflow fails on GitHub but no incident appears in `/platform/incidents`
- No GitHub Issue is created for the failure
- No email notification received

**Root Cause:** One of: QStash not configured, webhook signature verification failing, Anthropic API key missing, or the GitHub webhook not registered.

**Diagnostic Steps:**
```bash
# Check webhook delivery in GitHub
# GitHub repo → Settings → Webhooks → Recent Deliveries
# Look for 200 OK on workflow_run events

# Check if QStash is configured in the environment
# Doppler or Vercel env vars: QSTASH_TOKEN, QSTASH_URL, QSTASH_CURRENT_SIGNING_KEY

# Check Vercel Functions logs for /api/webhooks/github
# Look for: { "ok": true, "skipped": "qstash_not_configured" }
# or: { "error": "Unauthorized" }

# Check Vercel Functions logs for /api/process/ci
# Look for: { "level": "error", "processor": "ci", "event": "invalid_qstash_signature" }
```

**Resolution Steps:**
1. If `skipped: "qstash_not_configured"` — add `QSTASH_TOKEN`, `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` to Doppler and redeploy.
2. If `error: "Unauthorized"` on the webhook — regenerate the webhook secret in GitHub, update `GITHUB_WEBHOOK_SECRET` in Doppler, redeploy.
3. If Anthropic API call fails — verify `ANTHROPIC_API_KEY` in Doppler is valid and has quota remaining.
4. If no webhook deliveries at all — re-register the webhook in GitHub repo Settings → Webhooks.

**Prevention:** Add a smoke test that verifies `isQStashConfigured()` and `isDevopsConfigured()` on deployment.

---

### 2. Incident Appears as "Investigating" and Never Advances

**Symptoms:**
- An incident record exists in Redis with `status: "investigating"` indefinitely
- No GitHub Issue was created
- No email was sent

**Root Cause:** The CI/Sentry/Security agent ran `logIncident()` (which sets status to `"investigating"`) but threw before completing `markIncidentOpen()`. This can happen if the Anthropic API times out, GitHub API returns an error, or an uncaught exception occurs mid-agent.

**Diagnostic Steps:**
```bash
# Check Vercel Functions logs for the relevant processor:
# /api/process/ci, /api/process/sentry, /api/process/security
# Filter for: { "level": "error" }

# Check QStash dashboard for failed/retried message
# Upstash console → QStash → Messages
# Look for the message ID returned in the webhook response
```

**Resolution Steps:**
1. Identify the error from Vercel logs.
2. If it was a transient error (rate limit, timeout), QStash will have retried automatically (up to 3 times). Check if a later attempt succeeded.
3. If all retries failed, manually resolve the incident via the platform dashboard or API:
   ```bash
   curl -X POST https://dw-portfolio.dev/api/platform/incidents/{id}/resolve \
     -H "Content-Type: application/json" \
     -H "Cookie: <admin session cookie>" \
     -d '{"status": "resolved", "note": "Manual resolution: agent failed after 3 retries"}'
   ```
4. Fix the underlying agent error and re-test.

**Prevention:** Monitor QStash dead-letter queue. Add alerting on incidents that remain in `"investigating"` status for more than 10 minutes.

---

### 3. Duplicate Incidents in the Dashboard

**Symptoms:**
- Multiple incident records for the same CI run or Sentry issue
- GitHub Issues created more than once for the same event

**Root Cause:** The Redis dedup keys expired (24h for CI, 7d for Sentry) before a retry ran, or the dedup key namespace was changed.

**Diagnostic Steps:**
```bash
# Check Redis for dedup keys
# Using redis-cli (local) or Upstash console:
KEYS ci:failure:*
KEYS sentry:error:*

# Check if keys have correct TTLs:
TTL ci:failure:<runId>
```

**Resolution Steps:**
1. Manually resolve duplicate incidents via the dashboard (mark as `closed`).
2. If dedup keys are missing/expired prematurely, check that `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` point to the correct environment's Redis instance.
3. Verify the `Upstash-Deduplication-Id` headers are set correctly in `packages/qstash/src/publish.ts` — QStash-level dedup provides a second layer.

**Prevention:** Monitor duplicate incident count on the dashboard. The two-layer dedup (run ID + commit SHA) significantly reduces false duplicates.

---

### 4. Incident Not Auto-Resolving When GitHub Issue Closed

**Symptoms:**
- GitHub Issue is closed but the incident in the dashboard still shows `status: "open"`

**Root Cause:** The GitHub `issues.closed` webhook event is not being processed, or the issue does not have the `platform-agent` label.

**Diagnostic Steps:**
```bash
# 1. Check if the GitHub issue has the "platform-agent" label
# GitHub Issues list → check labels on the issue

# 2. Check GitHub webhook deliveries for issues.closed events
# GitHub repo → Settings → Webhooks → Recent Deliveries
# Filter for x-github-event: issues

# 3. Check Vercel logs for /api/webhooks/github
# Look for: { "ok": true, "ignored": "not_platform_agent_issue" }
# or: { "ok": true, "queued": true } (successfully enqueued)

# 4. Check Vercel logs for /api/process/resolve
# Look for errors in incident lookup by GitHub issue number
```

**Resolution Steps:**
1. If the issue lacks the `platform-agent` label — add the label and re-close the issue (GitHub will re-fire the webhook).
2. If webhook delivery failed — use GitHub's "Redeliver" button on the delivery.
3. If the incident record lacks a `githubIssueNumber` field (older incidents may not have it) — manually resolve via the dashboard.

---

### 5. Next.js Build Fails on Vercel

**Symptoms:**
- Vercel deployment fails during build
- Error relates to environment variable validation

**Root Cause:** Missing or malformed environment variable that fails Zod validation in one of the `@dw/validators/*` env schemas. The `next.config.js` imports `./src/env` via jiti at build time, triggering all env validators.

**Diagnostic Steps:**
```bash
# Vercel build logs will show a ZodError from @t3-oss/env-core
# Identify which validator is failing (db-env, clerk-env, etc.)
# Check the corresponding variable in Doppler / Vercel env vars
```

**Resolution Steps:**
1. Identify the missing variable from the build error.
2. Add/fix the value in Doppler under the appropriate config (`preview` or `production`).
3. Trigger a new deployment.

**Note:** All env validators have `skipValidation: !!process.env.CI` — this means CI runs skip validation. Build failures are environment configuration issues, not code bugs.

---

### 6. tRPC Calls Returning 500 in Production

**Symptoms:**
- Frontend receives `INTERNAL_SERVER_ERROR` from tRPC
- Users see error states in the UI

**Diagnostic Steps:**
```bash
# 1. Check Sentry for the error — it will be captured automatically
# 2. Check Vercel Functions logs for /api/trpc/*
# 3. Look for structured error output with the procedure path:
#    [TRPC] <procedure-name> took Xms to execute
```

**Resolution Steps:**
1. If it is a database connectivity issue — check Supabase dashboard for connection pool exhaustion. The ORM client caps at 3 connections; a spike in traffic could exhaust the pool. Consider increasing `max` in `packages/db/src/client.ts` if on a paid tier.
2. If it is a rate limit error (`TOO_MANY_REQUESTS`) — the `rateLimit()` middleware in `packages/redis/src/rate-limit.ts` is rejecting requests. Investigate unusual traffic patterns.
3. If it is an auth error — verify Clerk is functioning via `status.clerk.com`.

---

## Database Migration Runbook

Follow this procedure for every schema change that requires a migration.

### Step 1: Develop and Generate

```bash
# 1. Make your schema changes in:
#    packages/db/src/schema.ts
#    packages/db/src/auth-schema.ts

# 2. Generate the migration file
pnpm dw db generate
# Output: packages/db/drizzle/<timestamp>_<name>.sql

# 3. Review the generated SQL carefully
cat packages/db/drizzle/<timestamp>_<name>.sql
```

### Step 2: Test Locally

```bash
# Ensure Docker infra is running
pnpm -F @dw/dev-tools dev-tools:infra:up

# Apply to local Docker DB
pnpm dw db migrate.local

# Run tests to verify nothing is broken
pnpm test:api:infra
```

### Step 3: Deploy to Preview

```bash
# Push your branch — Vercel will deploy to preview
# The migration does NOT run automatically on deploy

# After preview deployment succeeds, run migration against preview DB:
# Set DIRECT_URL to the preview Supabase direct connection URL
DIRECT_URL=<preview-direct-url> pnpm dw db migrate
```

### Step 4: Deploy to Production

```bash
# 1. Merge to main branch (triggers Vercel production deploy)
# 2. Wait for deploy to complete BEFORE running migration
#    (deploy first, then migrate — prevents code/schema mismatch)

# 3. Run migration against production DB
# Set DIRECT_URL to the production Supabase direct connection URL
DIRECT_URL=<production-direct-url> pnpm dw db migrate
```

> Always use `DIRECT_URL` for migrations (not `DATABASE_URL`). PgBouncer in transaction pooling mode does not support `SET` commands required for migrations.

---

## Rollback Procedure

### Application Rollback (Vercel)

Vercel maintains a full deployment history. To roll back:
1. Open the Vercel dashboard for the `dw-portfolio` project.
2. Navigate to "Deployments".
3. Find the last known-good deployment.
4. Click the three-dot menu → "Promote to Production".

This takes effect immediately — no code changes or redeploys needed.

### Database Rollback

Drizzle does not generate automatic down migrations. For each migration, you must write a manual reversal.

**Process:**
1. Identify the migration to reverse from `packages/db/drizzle/`.
2. Write a SQL script that reverses the changes (drop columns, restore constraints, etc.).
3. Execute against the database using `psql` via the `DIRECT_URL`.
4. Delete the migration file from `packages/db/drizzle/` and commit.

> Schema rollbacks are high-risk. Always coordinate with any active users and take a Supabase database backup first (Supabase dashboard → Settings → Database → Backups).

### Incident Data Rollback (Redis)

Incident records in Redis are ephemeral and cannot be rolled back in the traditional sense. If bad data was written to Redis:
1. Use the platform dashboard to manually mark incorrect incidents as `closed`.
2. If bulk cleanup is needed, use the Upstash console to scan and delete affected keys matching the pattern `platform:incident:*`.
3. After deleting individual keys, also remove their IDs from the `platform:incidents:index` list.

---

## On-Call Escalation

This is a personal portfolio project — there is no formal on-call rotation. For production issues:

1. **Self-triage first** using the platform dashboard and Sentry.
2. **Check Vercel status** at `vercel-status.com` for platform-wide incidents.
3. **Check Supabase status** at `status.supabase.com` for database outages.
4. **Check Upstash status** at `status.upstash.com` for Redis/QStash outages.
5. **Check Anthropic status** at `status.anthropic.com` for API outages.
6. **Check Clerk status** at `status.clerk.com` for auth outages.

If a third-party service is down, the platform degrades gracefully:
- **Redis down**: Rate limiting bypasses, incident dashboard shows empty state.
- **QStash down**: Webhooks return `skipped: "qstash_not_configured"` — no incidents captured during outage.
- **Anthropic down**: Agent fails, QStash retries up to 3 times. Incident may remain in `"investigating"` state until manually resolved.
- **Supabase down**: tRPC mutations fail. Auth still works via Clerk (stateless tokens).
