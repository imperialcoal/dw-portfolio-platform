// apps/nextjs/src/app/api/platform/search/route.ts
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

function clerkUrl(path: string): string {
  if (!CLERK_APP_ID || !CLERK_INSTANCE_ID) return "https://dashboard.clerk.com";
  return `https://dashboard.clerk.com/apps/${CLERK_APP_ID}/instances/${CLERK_INSTANCE_ID}/${path}`;
}

function supabaseUrl(path: string): string {
  return `https://supabase.com/dashboard/project/${SUPABASE_REF}/${path}`;
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
    id: "supabase-db-logs",
    title: "Database Logs",
    subtitle: "Supabase → View Postgres logs",
    // Correct path: logs/postgres-logs (not database-logs)
    externalHref: supabaseUrl("logs/postgres-logs"),
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
    subtitle: "Clerk → Debug webhook endpoints and signing secrets",
    externalHref: clerkUrl("webhooks"),
  },
  {
    type: "deeplink",
    id: "clerk-audit-log",
    title: "Clerk Audit Log",
    subtitle: "Clerk → All authentication events",
    externalHref: clerkUrl("logs"),
  },
  {
    type: "deeplink",
    id: "clerk-restrictions",
    title: "Auth Restrictions",
    subtitle: "Clerk → Sign-up/sign-in mode and restrictions",
    externalHref: clerkUrl("user-authentication/restrictions"),
  },
  {
    type: "deeplink",
    id: "clerk-allowlist",
    title: "Allowlist",
    subtitle: "Clerk → Approved sign-up emails and domains",
    externalHref: clerkUrl("user-authentication/restrictions/allowlist"),
  },
  {
    type: "deeplink",
    id: "clerk-blocklist",
    title: "Blocklist",
    subtitle: "Clerk → Blocked emails and identifiers",
    externalHref: clerkUrl("user-authentication/restrictions/blocklist"),
  },
  {
    type: "deeplink",
    id: "clerk-email-templates",
    title: "Email Templates",
    subtitle: "Clerk → Magic link, verify, reset emails",
    externalHref: clerkUrl("customization/email"),
  },

  // ── Vercel ─────────────────────────────────────────────────────────────
  {
    type: "deeplink",
    id: "vercel-logs",
    title: "Vercel Function Logs",
    subtitle: "Vercel → Real-time serverless logs",
    externalHref:
      "https://vercel.com/imperial-coals-projects/dw-portfolio-platform/logs",
  },
  {
    type: "deeplink",
    id: "vercel-analytics",
    title: "Vercel Analytics",
    subtitle: "Vercel → Traffic, performance, and web vitals",
    externalHref:
      "https://vercel.com/imperial-coals-projects/dw-portfolio-platform/analytics",
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
  const deployments = await fetchRecentDeployments(20).catch(() => []);
  const matchingDeploys = deployments
    .filter(
      (d) =>
        d.id.toLowerCase().startsWith(q) ||
        (d.meta.githubCommitSha?.toLowerCase().startsWith(q) ?? false) ||
        (d.meta.githubCommitMessage?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 3)
    .map(
      (d): SearchResult => ({
        type: "deployment",
        id: d.id,
        title: d.meta.githubCommitMessage?.slice(0, 72) ?? d.id,
        subtitle: `${d.state} · ${d.meta.githubCommitSha?.slice(0, 7) ?? "—"} · ${d.meta.githubBranch ?? "—"}`,
        href: "/platform/deployments",
        timestamp: new Date(d.createdAt).toISOString(),
      }),
    );
  results.push(...matchingDeploys);

  // 4. User activity
  const activity = await getUserActivity(100).catch(() => []);
  const matchingActivity = activity
    .filter(
      (a) =>
        (a.userEmail?.toLowerCase().includes(q) ?? false) ||
        a.userId.toLowerCase().includes(q) ||
        (a.userName?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 3)
    .map(
      (a): SearchResult => ({
        type: "user_activity",
        id: a.id,
        title: a.userEmail ?? a.userId,
        subtitle: `${a.eventType} · ${new Date(a.timestamp).toLocaleString()}`,
        href: "/platform/users",
        timestamp: a.timestamp,
      }),
    );
  results.push(...matchingActivity);

  // 5. Clerk user profile deep-link for user IDs
  if (q.startsWith("user_") || /^[a-z0-9_]{20,}$/.exec(q)) {
    results.unshift({
      type: "deeplink",
      id: `clerk-user-${q}`,
      title: `View in Clerk: ${q}`,
      subtitle: "Clerk → Open user profile, check status, lock account",
      externalHref: clerkUrl(`users/${q}`),
    });
  }

  return NextResponse.json({ results: results.slice(0, 15) });
}
