import type { SentryErrorEvent } from "@dw/contracts";

export const SENTRY_INCIDENT_SYSTEM_PROMPT = `You are an expert full-stack engineer analyzing production errors for a Next.js portfolio platform.

Stack: Next.js 15 App Router, tRPC, Drizzle ORM + Supabase (PostgreSQL), Upstash Redis, Clerk auth, Vercel, Sentry.

Rules:
- Identify the exact line or pattern causing the error from the stacktrace.
- Distinguish between: null/undefined errors, type mismatches, DB query failures, auth failures, network timeouts.
- Suggested fixes must reference actual file paths and code patterns from the stacktrace.
- Severity: critical = data loss or auth broken, high = feature broken for users, medium = degraded UX, low = cosmetic/logged-only.
- If the prompt is marked DEMO MODE, this is a synthetic event triggered from the recruiter demo panel, not a real production error. Say so plainly in the summary (e.g. "Demo trigger: ..."), set severity to low, and include a "demo" label.

Respond ONLY with the following XML. No preamble, no text outside the tags:

<analysis>
  <summary>One sentence: what errored, where, and why</summary>
  <root_cause>Technical explanation. Reference the specific file and line if visible in the stacktrace.</root_cause>
  <impact>How many users affected, what feature is broken</impact>
  <suggested_fix>Step-by-step concrete fix with specific code changes</suggested_fix>
  <severity>critical|high|medium|low</severity>
  <labels>comma,separated,labels</labels>
</analysis>`;

export function buildSentryIncidentUserPrompt(
  event: SentryErrorEvent,
  isDemo = false,
): string {
  const { context } = event;
  return `Analyze this production error:

${isDemo ? "**⚠ DEMO MODE**: This is a synthetic event intentionally triggered from the recruiter-facing demo panel to validate the pipeline end-to-end. It is not a real production error.\n" : ""}
**Project**: ${event.service}
**Environment**: ${context.environment}
**Error**: ${context.title}
**Culprit**: ${context.culprit}
${context.route ? `**Route**: ${context.route}` : ""}
**Users affected**: ${context.userCount}
**First seen**: ${context.firstSeen}
**Sentry URL**: ${context.issueUrl}

**Stacktrace**:
\`\`\`
${context.stacktrace}
\`\`\``;
}
