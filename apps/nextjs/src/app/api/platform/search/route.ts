// Federated search across incidents (Redis), deployments (Vercel API),
// and user activity (Redis). Returns ranked results for the command palette.
// Admin-only. All data is already in-system — no external API calls for most queries.

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
// Deep-link catalog — static entries always available
// ─────────────────────────────────────────────

const SUPABASE_REF = env.SUPABASE_PROJECT_REF ?? "";
const CLERK_APP_ID = env.CLERK_APP_ID ?? "";
const CLERK_INSTANCE_ID = env.CLERK_INSTANCE_ID ?? "";

function clerkBase(): string {
  return `https://dashboard.clerk.com/apps/${CLERK_APP_ID}/instances/${CLERK_INSTANCE_ID}`;
}

const DEEPLINKS: SearchResult[] = [
  // Supabase
  {
    type: "deeplink",
    id: "supabase-sql",
    title: "Open SQL Editor",
    subtitle: "Supabase → Run a diagnostic query",
    externalHref: `https://supabase.com/dashboard/project/${SUPABASE_REF}/sql/new`,
  },
  {
    type: "deeplink",
    id: "supabase-db-logs",
    title: "Database Logs",
    subtitle: "Supabase → View Postgres logs",
    externalHref: `https://supabase.com/dashboard/project/${SUPABASE_REF}/logs/database-logs`,
  },
  {
    type: "deeplink",
    id: "supabase-table-editor",
    title: "Table Editor",
    subtitle: "Supabase → Browse or edit data",
    externalHref: `https://supabase.com/dashboard/project/${SUPABASE_REF}/editor`,
  },
  {
    type: "deeplink",
    id: "supabase-api",
    title: "Supabase API Docs",
    subtitle: "Supabase → Auto-generated REST endpoints",
    externalHref: `https://supabase.com/dashboard/project/${SUPABASE_REF}/api`,
  },
  // Clerk
  {
    type: "deeplink",
    id: "clerk-users",
    title: "Manage Users",
    subtitle: "Clerk → Full user list with roles and metadata",
    externalHref: `${clerkBase()}/users`,
  },
  {
    type: "deeplink",
    id: "clerk-webhooks",
    title: "Clerk Webhooks",
    subtitle: "Clerk → Debug webhook endpoints and signing secrets",
    externalHref: `${clerkBase()}/webhooks`,
  },
  {
    type: "deeplink",
    id: "clerk-sessions",
    title: "Active Sessions",
    subtitle: "Clerk → View and revoke live sessions",
    externalHref: `${clerkBase()}/sessions`,
  },
  {
    type: "deeplink",
    id: "clerk-audit-log",
    title: "Clerk Audit Log",
    subtitle: "Clerk → All authentication events",
    externalHref: `${clerkBase()}/logs`,
  },
  {
    type: "deeplink",
    id: "clerk-email-templates",
    title: "Email Templates",
    subtitle: "Clerk → Customize auth emails (magic link, verify, etc.)",
    externalHref: `${clerkBase()}/email-sms-templates`,
  },
  // Vercel
  {
    type: "deeplink",
    id: "vercel-logs",
    title: "Vercel Function Logs",
    subtitle: "Vercel → Real-time serverless logs",
    externalHref: `https://vercel.com/imperial-coals-projects/dw-portfolio-platform/logs`,
  },
  {
    type: "deeplink",
    id: "vercel-analytics",
    title: "Vercel Analytics",
    subtitle: "Vercel → Traffic, performance, and web vitals",
    externalHref: `https://vercel.com/imperial-coals-projects/dw-portfolio-platform/analytics`,
  },
  // Internal platform pages
  {
    type: "deeplink",
    id: "platform-maintenance",
    title: "Maintenance Mode",
    subtitle: "Platform → Toggle maintenance mode",
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
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim() ?? "";

  if (!q || q.length < 2) {
    // Return static deep-links when no query
    return NextResponse.json({ results: DEEPLINKS.slice(0, 8) });
  }

  const results: SearchResult[] = [];

  // 1. Filter deep-links
  const matchingLinks = DEEPLINKS.filter(
    (l) =>
      l.title.toLowerCase().includes(q) ||
      l.subtitle.toLowerCase().includes(q) ||
      l.id.includes(q),
  );
  results.push(...matchingLinks);

  // 2. Search incidents
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
        href: `/platform/incidents`,
        severity: i.severity,
        timestamp: i.timestamp,
      }),
    );
  results.push(...matchingIncidents);

  // 3. Search deployments by commit SHA or message
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

  // 4. Search user activity by email or userId
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
        href: `/platform/users`,
        timestamp: a.timestamp,
      }),
    );
  results.push(...matchingActivity);

  // If query looks like a Clerk user ID, add a direct deep-link to their profile
  if (q.startsWith("user_") || /^[a-z0-9_]{20,}$/.exec(q)) {
    results.unshift({
      type: "deeplink",
      id: `clerk-user-${q}`,
      title: `View user in Clerk: ${q}`,
      subtitle: "Clerk → Open user profile, check status, lock account",
      externalHref: `${clerkBase()}/users/${q}`,
    });
  }

  return NextResponse.json({ results: results.slice(0, 15) });
}
