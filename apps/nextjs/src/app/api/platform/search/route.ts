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
// ─────────────────────────────────────────────

const SUPABASE_REF = env.SUPABASE_PROJECT_REF ?? "";
const CLERK_APP_ID = env.CLERK_APP_ID ?? "";
const CLERK_INSTANCE_ID = env.CLERK_INSTANCE_ID ?? "";
const VERCEL_TEAM = env.VERCEL_TEAM_ID ?? "";
const VERCEL_PROJECT = env.VERCEL_PROJECT_ID ?? "";
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

function vercelUrl(path: string): string {
  const team = VERCEL_TEAM ? `${VERCEL_TEAM}/` : "";
  const project = VERCEL_PROJECT;
  return `https://vercel.com/${team}${project}/${path}`;
}

function sentryUrl(path: string): string {
  if (!SENTRY_ORG) return "https://sentry.io";
  return `https://sentry.io/organizations/${SENTRY_ORG}/${path}`;
}

function githubUrl(path: string): string {
  const repo = GITHUB_REPO;
  return `https://github.com/${repo}/${path}`;
}

const DEEPLINKS: SearchResult[] = [
  // ── Supabase ───────────────────────────────────────────────────────────
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
    subtitle: "Supabase → View Postgres logs",
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
    title: "Auth Settings",
    subtitle: "Supabase → JWT, providers, rate limits",
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
  {
    type: "deeplink",
    id: "clerk-users",
    title: "Manage Users",
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
    title: "Audit Log",
    subtitle: "Clerk → Auth event history",
    externalHref: clerkUrl("audit-log"),
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

  // ── GitHub ─────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "github-issues",
    title: "GitHub Issues",
    subtitle: "GitHub → Platform-agent created issues",
    externalHref: githubUrl("issues?q=label%3Aplatform-agent+is%3Aopen"),
  },
  {
    type: "deeplink",
    id: "github-actions",
    title: "GitHub Actions",
    subtitle: "GitHub → CI workflow runs",
    externalHref: githubUrl("actions"),
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
    id: "platform-deployments",
    title: "Deployments",
    subtitle: "Platform → View and roll back deployments",
    href: "/platform/deployments",
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
    id: "platform-database",
    title: "Database Health",
    subtitle: "Platform → Table sizes, connections, advisories",
    href: "/platform/database",
  },
  {
    type: "deeplink",
    id: "platform-users",
    title: "User Activity",
    subtitle: "Platform → Auth events and user timeline",
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
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim() ?? "";

  if (!q || q.length < 2) {
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
    .map(
      (i): SearchResult => ({
        type: "incident",
        id: i.id,
        title: i.summary,
        subtitle: `${i.type.replace("_", " ")} · ${i.status} · ${i.severity}`,
        href: "/platform/incidents",
        severity: i.severity,
        timestamp: i.timestamp,
      }),
    );
  results.push(...matchingIncidents);

  // 3. Deployments
  const deploys = await fetchRecentDeployments(20).catch(() => []);
  const matchingDeploys = deploys
    .filter(
      (d) =>
        d.meta.githubCommitMessage?.toLowerCase().includes(q) ??
        d.meta.githubCommitSha?.toLowerCase().startsWith(q) ??
        d.meta.githubCommitAuthorName?.toLowerCase().includes(q),
    )
    .slice(0, 3)
    .map(
      (d): SearchResult => ({
        type: "deployment",
        id: d.id,
        title: d.meta.githubCommitMessage?.slice(0, 60) ?? d.id,
        subtitle: `${d.state} · ${d.meta.githubCommitSha?.slice(0, 7) ?? ""}`,
        href: "/platform/deployments",
        timestamp: new Date(d.createdAt).toISOString(),
      }),
    );
  results.push(...matchingDeploys);

  // 4. User activity — UserActivityRecord uses eventType, not event
  const activity = await getUserActivity(50).catch(() => []);
  const matchingActivity = activity
    .filter(
      (a) =>
        (a.userEmail?.toLowerCase().includes(q) ?? false) ||
        a.userId.toLowerCase().includes(q) ||
        a.eventType.toLowerCase().includes(q),
    )
    .slice(0, 3)
    .map(
      (a): SearchResult => ({
        type: "user_activity",
        id: a.userId,
        title: a.userEmail ?? a.userId,
        subtitle: `${a.eventType} · ${new Date(a.timestamp).toLocaleDateString()}`,
        href: "/platform/users",
        timestamp: a.timestamp,
      }),
    );
  results.push(...matchingActivity);

  return NextResponse.json({ results: results.slice(0, 12) });
}
