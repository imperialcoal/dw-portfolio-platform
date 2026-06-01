// Federated search — incidents, deployments, user activity, static deep-links.
// Admin-only.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getIncidents, getUserActivity } from "@dw/ai/memory";
import { fetchRecentDeployments } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";
import { env } from "~/env";

export const runtime = "nodejs";
export const maxDuration = 15;

export interface SearchResult {
  type: "incident" | "deployment" | "user_activity" | "deeplink";
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  externalHref?: string;
  severity?: string;
  timestamp?: string;
}

// ─────────────────────────────────────────────
// Deep-link catalog
//
// Vercel dashboard URLs use human-readable slugs, NOT the team_xxx / prj_xxx
// IDs stored in VERCEL_TEAM_ID / VERCEL_PROJECT_ID (those are API-only).
// Slugs are stable, non-secret constants that only change if you rename
// the team or project in the Vercel dashboard.
//
// Supabase and Clerk deep-links ARE intentionally kept here even though they
// also appear on their own internal pages (/platform/database and
// /platform/users). The command palette is a keyboard-driven "jump anywhere"
// tool — a user typing "sql" or "users" expects to land somewhere useful
// immediately. The home page External Services section is a different surface
// (visual overview of external services without an internal page) and
// correctly omits Supabase/Clerk to avoid redundancy there.
// ─────────────────────────────────────────────

const VERCEL_TEAM_SLUG = "imperialcoals-projects";
const VERCEL_PROJECT_SLUG = "dw-portfolio-platform";

const SUPABASE_REF = env.SUPABASE_PROJECT_REF ?? "";
const CLERK_APP_ID = env.CLERK_APP_ID ?? "";
const CLERK_INSTANCE_ID = env.CLERK_INSTANCE_ID ?? "";
const SENTRY_ORG = env.SENTRY_ORG ?? "";
const SENTRY_PROJECT_SLUG = env.SENTRY_PROJECT ?? "";
const GITHUB_REPO = env.GITHUB_REPO ?? "";

function clerkUrl(path: string): string {
  if (!CLERK_APP_ID || !CLERK_INSTANCE_ID) return "https://dashboard.clerk.com";
  return `https://dashboard.clerk.com/apps/${CLERK_APP_ID}/instances/${CLERK_INSTANCE_ID}/${path}`;
}

function supabaseUrl(path: string): string {
  if (!SUPABASE_REF) return "https://supabase.com/dashboard";
  return `https://supabase.com/dashboard/project/${SUPABASE_REF}/${path}`;
}

// Vercel dashboard URLs use slugs, not IDs.
// https://vercel.com/{team-slug}/{project-slug}/{path}
function vercelUrl(path: string): string {
  return `https://vercel.com/${VERCEL_TEAM_SLUG}/${VERCEL_PROJECT_SLUG}/${path}`;
}

function sentryUrl(path: string): string {
  if (!SENTRY_ORG) return "https://sentry.io";
  return `https://sentry.io/organizations/${SENTRY_ORG}/${path}`;
}

function githubUrl(path: string): string {
  if (!GITHUB_REPO) return "https://github.com";
  return `https://github.com/${GITHUB_REPO}/${path}`;
}

const DEEPLINKS: SearchResult[] = [
  // ── Internal platform pages ────────────────────────────────────────────
  {
    type: "deeplink",
    id: "platform-home",
    title: "Platform Home",
    subtitle: "Platform → Overview, incidents, maintenance mode",
    href: "/platform",
  },
  {
    type: "deeplink",
    id: "platform-incidents",
    title: "Incidents",
    subtitle: "Platform → Full incident history and AI analysis",
    href: "/platform/incidents",
  },
  {
    type: "deeplink",
    id: "platform-deployments",
    title: "Deployments",
    subtitle: "Platform → View and roll back deployments",
    href: "/platform/deployments",
  },
  {
    type: "deeplink",
    id: "platform-database",
    title: "Database Health",
    subtitle: "Platform → Table sizes, connections, and security advisories",
    href: "/platform/database",
  },
  {
    type: "deeplink",
    id: "platform-users",
    title: "User Activity",
    subtitle: "Platform → Clerk auth events, sign-ins, and security signals",
    href: "/platform/users",
  },
  {
    type: "deeplink",
    id: "platform-dependencies",
    title: "Dependencies",
    subtitle: "Platform → Dependabot PRs and security alerts",
    href: "/platform/dependencies",
  },
  {
    type: "deeplink",
    id: "platform-insights",
    title: "AI Insights",
    subtitle: "Platform → Pattern analysis and recommendations",
    href: "/platform/insights",
  },

  // ── Vercel ─────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "vercel-logs",
    title: "Vercel Logs",
    subtitle: "Vercel → Live function and edge runtime logs",
    externalHref: vercelUrl("logs"),
  },
  {
    type: "deeplink",
    id: "vercel-deployments",
    title: "Vercel Deployments",
    subtitle: "Vercel → All deployments with build logs",
    externalHref: vercelUrl("deployments"),
  },
  {
    type: "deeplink",
    id: "vercel-analytics",
    title: "Vercel Analytics",
    subtitle: "Vercel → Traffic, performance, and web vitals",
    externalHref: vercelUrl("analytics"),
  },
  {
    type: "deeplink",
    id: "vercel-functions",
    title: "Vercel Functions",
    subtitle: "Vercel → Serverless function invocations and errors",
    externalHref: vercelUrl("functions"),
  },
  {
    type: "deeplink",
    id: "vercel-settings",
    title: "Vercel Settings",
    subtitle: "Vercel → Env vars, domains, and integrations",
    externalHref: vercelUrl("settings"),
  },

  // ── Sentry ─────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "sentry-issues",
    title: "Sentry Issues",
    subtitle: "Sentry → Unresolved runtime errors",
    externalHref: sentryUrl(`issues/?project=${SENTRY_PROJECT_SLUG}`),
  },
  {
    type: "deeplink",
    id: "sentry-performance",
    title: "Sentry Performance",
    subtitle: "Sentry → Transaction traces and slowdowns",
    externalHref: sentryUrl(`performance/?project=${SENTRY_PROJECT_SLUG}`),
  },
  {
    type: "deeplink",
    id: "sentry-alerts",
    title: "Sentry Alerts",
    subtitle: "Sentry → Alert rules and notification history",
    externalHref: sentryUrl(`alerts/rules/?project=${SENTRY_PROJECT_SLUG}`),
  },
  {
    type: "deeplink",
    id: "sentry-releases",
    title: "Sentry Releases",
    subtitle: "Sentry → Deploy tracking and regression detection",
    externalHref: sentryUrl(`releases/?project=${SENTRY_PROJECT_SLUG}`),
  },

  // ── GitHub ─────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "github-actions",
    title: "GitHub Actions",
    subtitle: "GitHub → CI workflow runs",
    externalHref: githubUrl("actions"),
  },
  {
    type: "deeplink",
    id: "github-issues",
    title: "GitHub Issues",
    subtitle: "GitHub → Platform-agent created issues",
    externalHref: githubUrl("issues?q=label%3Aplatform-agent+is%3Aopen"),
  },
  {
    type: "deeplink",
    id: "github-security",
    title: "GitHub Security",
    subtitle: "GitHub → Dependabot alerts and code scanning",
    externalHref: githubUrl("security"),
  },
  {
    type: "deeplink",
    id: "github-pulls",
    title: "Pull Requests",
    subtitle: "GitHub → Open PRs including Dependabot updates",
    externalHref: githubUrl("pulls"),
  },
  {
    type: "deeplink",
    id: "github-webhooks",
    title: "GitHub Webhooks",
    subtitle: "GitHub → Webhook delivery history and failures",
    externalHref: githubUrl("settings/hooks"),
  },

  // ── Supabase ───────────────────────────────────────────────────────────
  // Also surfaced on /platform/database — kept here so keyboard search
  // ("sql", "postgres", "rls") lands somewhere useful immediately.
  {
    type: "deeplink",
    id: "supabase-sql",
    title: "SQL Editor",
    subtitle: "Supabase → Run a diagnostic query",
    externalHref: supabaseUrl("sql/new"),
  },
  {
    type: "deeplink",
    id: "supabase-table-editor",
    title: "Table Editor",
    subtitle: "Supabase → Browse or edit data",
    externalHref: supabaseUrl("editor"),
  },
  {
    type: "deeplink",
    id: "supabase-db-logs",
    title: "Database Logs",
    subtitle: "Supabase → View Postgres query and error logs",
    externalHref: supabaseUrl("logs/postgres-logs"),
  },
  {
    type: "deeplink",
    id: "supabase-security-advisor",
    title: "Security Advisor",
    subtitle: "Supabase → RLS, anon exposure, and linter checks",
    externalHref: supabaseUrl("advisors/security"),
  },
  {
    type: "deeplink",
    id: "supabase-auth-settings",
    title: "Supabase Auth Settings",
    subtitle: "Supabase → JWT, providers, and rate limits",
    externalHref: supabaseUrl("auth/users"),
  },
  {
    type: "deeplink",
    id: "supabase-api",
    title: "Supabase API Docs",
    subtitle: "Supabase → Auto-generated REST endpoints",
    externalHref: supabaseUrl("api"),
  },

  // ── Clerk ──────────────────────────────────────────────────────────────
  // Also surfaced on /platform/users — kept here so keyboard search
  // ("users", "sessions", "clerk") lands somewhere useful immediately.
  {
    type: "deeplink",
    id: "clerk-users",
    title: "Clerk Users",
    subtitle: "Clerk → Full user list with roles and metadata",
    externalHref: clerkUrl("users"),
  },
  {
    type: "deeplink",
    id: "clerk-sessions",
    title: "Active Sessions",
    subtitle: "Clerk → View and revoke live sessions",
    externalHref: clerkUrl("sessions"),
  },
  {
    type: "deeplink",
    id: "clerk-webhooks",
    title: "Clerk Webhooks",
    subtitle: "Clerk → Debug webhook deliveries and signing secrets",
    externalHref: clerkUrl("webhooks"),
  },
  {
    type: "deeplink",
    id: "clerk-audit-log",
    title: "Clerk Audit Log",
    subtitle: "Clerk → Full auth event history",
    externalHref: clerkUrl("audit-log"),
  },

  // ── Upstash ────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "upstash-redis",
    title: "Upstash Redis",
    subtitle: "Upstash → Browse incident data, keys, and TTLs",
    externalHref: "https://console.upstash.com/redis",
  },
  {
    type: "deeplink",
    id: "upstash-qstash",
    title: "Upstash QStash",
    subtitle: "Upstash → Job queue, delivery logs, and dead-letter queue",
    externalHref: "https://console.upstash.com/qstash",
  },

  // ── Resend ─────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "resend-logs",
    title: "Resend Email Logs",
    subtitle: "Resend → Incident alert and contact form delivery logs",
    externalHref: "https://resend.com/emails",
  },
  {
    type: "deeplink",
    id: "resend-domains",
    title: "Resend Domains",
    subtitle: "Resend → Domain verification and DNS records",
    externalHref: "https://resend.com/domains",
  },

  // ── Doppler ────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "doppler-secrets",
    title: "Doppler Secrets",
    subtitle: "Doppler → View and update environment variables",
    externalHref: "https://dashboard.doppler.com",
  },
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim() ?? "";

  if (!q || q.length < 2) {
    // Default: show internal platform pages first for zero-query state
    return NextResponse.json({ results: DEEPLINKS.slice(0, 8) });
  }

  const results: SearchResult[] = [];

  // 1. Deep-links
  const matchingLinks = DEEPLINKS.filter(
    (l) =>
      l.title.toLowerCase().includes(q) ||
      l.subtitle.toLowerCase().includes(q) ||
      l.id.includes(q),
  );
  results.push(...matchingLinks);

  // 2. Incidents
  // IncidentRecord uses `timestamp` (not `createdAt`) per contracts/src/ai/incidents.ts
  const incidents = await getIncidents(100).catch(() => []);
  const matchingIncidents = incidents
    .filter(
      (i) =>
        i.summary.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.rootCause.toLowerCase().includes(q) ||
        i.labels.some((l) => l.toLowerCase().includes(q)) ||
        (i.commitSha?.toLowerCase().startsWith(q) ?? false),
    )
    .slice(0, 5)
    .map((i) => ({
      type: "incident" as const,
      id: i.id,
      title: i.summary,
      subtitle: `${i.type} · ${i.status} · ${i.severity}`,
      href: `/platform/incidents`,
      severity: i.severity,
      timestamp: i.timestamp,
    }));
  results.push(...matchingIncidents);

  // 3. Deployments
  // VercelDeployment.createdAt is a Unix timestamp (number), convert to ISO string
  const deployments = await fetchRecentDeployments(20).catch(() => []);
  const matchingDeployments = deployments
    .filter(
      (d) =>
        (d.meta.githubCommitMessage?.toLowerCase().includes(q) ?? false) ||
        (d.meta.githubCommitSha?.toLowerCase().startsWith(q) ?? false) ||
        (d.meta.githubBranch?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 3)
    .map((d) => ({
      type: "deployment" as const,
      id: d.id,
      title: d.meta.githubCommitMessage ?? d.id,
      subtitle: `${d.target ?? "preview"} · ${d.state} · ${d.meta.githubBranch ?? ""}`,
      href: `/platform/deployments`,
      timestamp: new Date(d.createdAt).toISOString(),
    }));
  results.push(...matchingDeployments);

  // 4. User activity
  // UserActivityRecord uses `userEmail` (not `email`), `timestamp` (not `createdAt`),
  // and has no `appName` field — per contracts/src/ai/user-activity.ts
  const activity = await getUserActivity(50).catch(() => []);
  const matchingActivity = activity
    .filter(
      (a) =>
        (a.userEmail?.toLowerCase().includes(q) ?? false) ||
        a.userId.toLowerCase().includes(q) ||
        a.eventType.toLowerCase().includes(q),
    )
    .slice(0, 3)
    .map((a) => ({
      type: "user_activity" as const,
      id: a.id,
      title: a.userEmail ?? a.userId,
      subtitle: a.eventType,
      href: `/platform/users`,
      timestamp: a.timestamp,
    }));
  results.push(...matchingActivity);

  return NextResponse.json({ results: results.slice(0, 20) });
}
