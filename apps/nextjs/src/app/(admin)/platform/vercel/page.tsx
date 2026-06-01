// apps/nextjs/src/app/(admin)/platform/vercel/page.tsx
//
// Vercel service page — live deployment data from the Vercel sensor,
// plus a quick access grid for all Vercel dashboard deep-links.
//
// Follows the same pattern as /platform/database and /platform/users:
// live data at the top, quick access grid at the bottom.

import Link from "next/link";

import type { VercelDeployment } from "@dw/contracts";
import { fetchRecentDeployments } from "@dw/ai/sensors";

// Force dynamic — fetches live Vercel API data on every request
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// Vercel slug constants
//
// Dashboard URLs use human-readable slugs, NOT the team_xxx / prj_xxx IDs
// stored in VERCEL_TEAM_ID / VERCEL_PROJECT_ID (those are API-only).
// These are stable, non-secret constants. Only change if you rename the
// team or project in the Vercel dashboard.
// ─────────────────────────────────────────────

const VERCEL_TEAM_SLUG = "imperialcoals-projects";
const VERCEL_PROJECT_SLUG = "dw-portfolio-platform";

function vercel(path: string): string {
  return `https://vercel.com/${VERCEL_TEAM_SLUG}/${VERCEL_PROJECT_SLUG}/${path}`;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATE_STYLES: Record<string, { badge: string; label: string }> = {
  READY: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "Ready",
  },
  ERROR: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Error",
  },
  BUILDING: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "Building",
  },
  CANCELED: {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    label: "Canceled",
  },
};

function stateStyle(state: string): { badge: string; label: string } {
  return (
    STATE_STYLES[state] ?? {
      badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      label: state,
    }
  );
}

const QUICK_ACCESS = [
  {
    label: "Logs",
    desc: "Live function and edge runtime logs",
    href: vercel("logs"),
  },
  {
    label: "Deployments",
    desc: "All deployments with build output",
    href: vercel("deployments"),
  },
  {
    label: "Analytics",
    desc: "Traffic, performance, web vitals",
    href: vercel("analytics"),
  },
  {
    label: "Functions",
    desc: "Serverless invocations and errors",
    href: vercel("functions"),
  },
  {
    label: "Speed Insights",
    desc: "Core Web Vitals breakdown",
    href: vercel("speed-insights"),
  },
  {
    label: "Settings",
    desc: "Env vars, domains, integrations",
    href: vercel("settings"),
  },
  {
    label: "Domains",
    desc: "Custom domain configuration",
    href: vercel("settings/domains"),
  },
  {
    label: "Environment Variables",
    desc: "Preview, production, and development vars",
    href: vercel("settings/environment-variables"),
  },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function DeploymentRow({ deploy }: { deploy: VercelDeployment }) {
  const sha = deploy.meta.githubCommitSha?.slice(0, 7) ?? "—";
  const msg =
    deploy.meta.githubCommitMessage?.slice(0, 80) ??
    deploy.meta.githubCommitMessage ??
    deploy.id;
  const branch = deploy.meta.githubBranch ?? deploy.target ?? "unknown";
  const age = timeAgo(deploy.createdAt);
  const state = stateStyle(deploy.state);
  const deployUrl = `https://${deploy.url}`;

  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${state.badge}`}
      >
        {state.label}
      </span>
      <code className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400">
        {sha}
      </code>
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-300">{msg}</p>
      <span className="shrink-0 text-xs text-zinc-600">{branch}</span>
      <span className="shrink-0 text-xs text-zinc-600">{age}</span>
      <a
        href={deployUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        Open →
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function VercelPage() {
  const deployments = await fetchRecentDeployments(10).catch(() => []);

  const readyCount = deployments.filter((d) => d.state === "READY").length;
  const errorCount = deployments.filter((d) => d.state === "ERROR").length;
  const buildingCount = deployments.filter(
    (d) => d.state === "BUILDING",
  ).length;

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/platform"
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
              ← Platform
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Vercel
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Hosting · {VERCEL_TEAM_SLUG} / {VERCEL_PROJECT_SLUG}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={vercel("logs")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Logs →
            </a>
            <a
              href={vercel("settings")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Settings →
            </a>
          </div>
        </div>

        {/* Deployment summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Ready
            </p>
            <p className="text-3xl font-bold text-green-400 tabular-nums">
              {readyCount}
            </p>
            <p className="mt-1 text-xs text-zinc-600">last 10 deployments</p>
          </div>
          <div
            className={`rounded-xl border p-5 ${errorCount > 0 ? "border-red-500/20 bg-red-500/5" : "border-white/10 bg-white/5"}`}
          >
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Errors
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${errorCount > 0 ? "text-red-400" : "text-white"}`}
            >
              {errorCount}
            </p>
            <p className="mt-1 text-xs text-zinc-600">build failures</p>
          </div>
          <div
            className={`rounded-xl border p-5 ${buildingCount > 0 ? "border-blue-500/20 bg-blue-500/5" : "border-white/10 bg-white/5"}`}
          >
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Building
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${buildingCount > 0 ? "text-blue-400" : "text-white"}`}
            >
              {buildingCount}
            </p>
            <p className="mt-1 text-xs text-zinc-600">in progress</p>
          </div>
        </div>

        {/* Recent deployments */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
              Recent Deployments
            </h2>
            <a
              href={vercel("deployments")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              View all in Vercel →
            </a>
          </div>
          {deployments.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/3 px-5 py-8 text-center">
              <p className="text-sm text-zinc-500">No deployments found.</p>
              <p className="mt-1 text-xs text-zinc-700">
                Check that VERCEL_API_TOKEN and VERCEL_PROJECT_ID are
                configured.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {deployments.map((d) => (
                <DeploymentRow key={d.id} deploy={d} />
              ))}
            </div>
          )}
        </div>

        {/* Quick access */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Vercel Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACCESS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20 hover:bg-white/10"
              >
                <p className="text-sm font-medium text-zinc-200">
                  {link.label}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">{link.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
