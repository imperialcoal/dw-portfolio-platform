// Centralized tooltip copy for all external deep links shown on platform pages.
// Imported by each platform page that uses DemoDeepLink so tooltip descriptions
// are defined once and consistent across the entire dashboard.
//
// Each entry maps a link identifier to its tooltip description shown when
// isDemo=true. Descriptions explain what the service does and why it requires
// admin credentials — giving recruiters full context without access.
//
// To remove demo mode: delete src/demo/ — these strings go with it.

export const DEMO_TOOLTIPS = {
  // ── Upstash ──────────────────────────────────────────────────────────────
  upstashRedis:
    "Live Redis console — browse all incident records, TTLs, and cached user sessions in real time. Contains production data.",
  upstashQstash:
    "QStash job queue — view delivery logs, retry history, and dead-letter queue for every CI and Sentry webhook processed by the AI agent.",

  // ── Vercel ───────────────────────────────────────────────────────────────
  vercelLogs:
    "Live Vercel function and edge runtime logs — requires team membership to access.",
  vercelDeployments:
    "All Vercel deployments with build logs and rollback controls — admin credentials required.",
  vercelAnalytics:
    "Vercel traffic analytics, Core Web Vitals, and performance trends — team access only.",
  vercelFunctions:
    "Serverless function invocations, cold start metrics, and runtime errors — admin only.",
  vercelSettings:
    "Vercel project settings — environment variables, domains, and integrations. Admin only.",

  // ── Sentry ───────────────────────────────────────────────────────────────
  sentryIssues:
    "Sentry error tracker — unresolved runtime exceptions with stack traces. Org membership required.",
  sentryPerformance:
    "Sentry performance — transaction traces, slowdowns, and N+1 queries. Org membership required.",
  sentryReplays:
    "Sentry session replays — full user session recordings tied to error events. Admin access only.",
  sentryAlerts:
    "Sentry alert rules — thresholds that trigger the QStash → AI agent incident pipeline.",

  // ── GitHub ───────────────────────────────────────────────────────────────
  githubActions:
    "GitHub Actions CI — workflow runs, failure logs, and the events that trigger this platform's incident pipeline.",
  githubIssues:
    "GitHub Issues — auto-created by the AI agent when a CI failure or Sentry error is classified as actionable.",
  githubPRs:
    "GitHub pull requests — Dependabot security PRs surfaced in the Dependencies dashboard.",
  githubSecurity:
    "GitHub security advisories and Dependabot alerts — feeds the security incident pipeline.",

  // ── Clerk ────────────────────────────────────────────────────────────────
  clerkUsers:
    "Clerk user management — full user list with roles, metadata, and session history. Admin only.",
  clerkSessions:
    "Clerk active sessions — view and revoke live sessions. Admin credentials required.",
  clerkWebhooks:
    "Clerk webhook deliveries — debug the user.created and session events that provision this platform's users.",
  clerkAuditLog:
    "Clerk audit log — full authentication event history. Admin credentials required.",

  // ── Resend ───────────────────────────────────────────────────────────────
  resendEmails:
    "Resend email logs — incident alert and contact form delivery history. API key required.",
  resendDomains:
    "Resend domain configuration — DNS records and verification status for dw-portfolio.dev.",

  // ── Doppler ──────────────────────────────────────────────────────────────
  doppler:
    "Doppler secrets dashboard — all environment variables including API keys and webhook secrets. Admin only.",

  // ── Supabase ─────────────────────────────────────────────────────────────
  supabaseEditor:
    "Supabase SQL editor — direct database access. Contains production user data and incident records.",
  supabaseAdvisor:
    "Supabase security advisor — RLS policy analysis and performance recommendations.",
  supabaseLogs:
    "Supabase database logs — query performance, connection pooling, and error logs.",
} as const;

export type DemoTooltipKey = keyof typeof DEMO_TOOLTIPS;
