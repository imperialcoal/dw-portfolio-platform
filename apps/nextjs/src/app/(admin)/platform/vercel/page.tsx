// apps/nextjs/src/app/(admin)/platform/vercel/page.tsx
import Link from "next/link";

import type { VercelDeployment } from "@dw/contracts";
import { fetchRecentDeployments } from "@dw/ai/sensors";

export const dynamic = "force-dynamic";

const VERCEL_TEAM_SLUG = "imperialcoals-projects";
const VERCEL_PROJECT_SLUG = "dw-portfolio-platform";
function vercel(path: string) {
  return `https://vercel.com/${VERCEL_TEAM_SLUG}/${VERCEL_PROJECT_SLUG}/${path}`;
}

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
    badge: "bg-muted text-muted-foreground border-border",
    label: "Canceled",
  },
};
function stateStyle(state: string) {
  return (
    STATE_STYLES[state] ?? {
      badge: "bg-muted text-muted-foreground border-border",
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

function DeploymentRow({ deploy }: { deploy: VercelDeployment }) {
  const sha = deploy.meta.githubCommitSha?.slice(0, 7) ?? "—";
  const msg = deploy.meta.githubCommitMessage?.slice(0, 80) ?? deploy.id;
  const branch = deploy.meta.githubBranch ?? deploy.target ?? "unknown";
  const state = stateStyle(deploy.state);
  return (
    <div className="border-border flex items-center gap-3 border-b px-4 py-3 last:border-0">
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${state.badge}`}
      >
        {state.label}
      </span>
      <code className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[11px]">
        {sha}
      </code>
      <p className="text-foreground min-w-0 flex-1 truncate text-sm">{msg}</p>
      <span className="text-muted-foreground shrink-0 text-xs">{branch}</span>
      <span className="text-muted-foreground shrink-0 text-xs">
        {timeAgo(deploy.createdAt)}
      </span>
      <a
        href={`https://${deploy.url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground shrink-0 text-xs transition-colors"
      >
        Open →
      </a>
    </div>
  );
}

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
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/platform"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              ← Platform
            </Link>
            <div>
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                Vercel Dashboard
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Hosting · {VERCEL_TEAM_SLUG} / {VERCEL_PROJECT_SLUG}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={vercel("logs")}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors"
            >
              Logs →
            </a>
            <a
              href={vercel("settings")}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors"
            >
              Settings →
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border-border bg-muted/40 rounded-xl border p-5">
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
              Ready
            </p>
            <p className="text-3xl font-bold text-green-400 tabular-nums">
              {readyCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              last 10 deployments
            </p>
          </div>
          <div
            className={`rounded-xl border p-5 ${errorCount > 0 ? "border-red-500/20 bg-red-500/5" : "border-border bg-muted/40"}`}
          >
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
              Errors
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${errorCount > 0 ? "text-red-400" : "text-foreground"}`}
            >
              {errorCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">build failures</p>
          </div>
          <div
            className={`rounded-xl border p-5 ${buildingCount > 0 ? "border-blue-500/20 bg-blue-500/5" : "border-border bg-muted/40"}`}
          >
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
              Building
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${buildingCount > 0 ? "text-blue-400" : "text-foreground"}`}
            >
              {buildingCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">in progress</p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
              Recent Deployments
            </h2>
            <a
              href={vercel("deployments")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              View all in Vercel →
            </a>
          </div>
          {deployments.length === 0 ? (
            <div className="border-border bg-muted/40 rounded-xl border px-5 py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No deployments found.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Check that VERCEL_API_TOKEN and VERCEL_PROJECT_ID are
                configured.
              </p>
            </div>
          ) : (
            <div className="border-border bg-muted/40 overflow-hidden rounded-xl border">
              {deployments.map((d) => (
                <DeploymentRow key={d.id} deploy={d} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            Vercel Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACCESS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-muted/40 hover:border-border hover:bg-muted/60 rounded-xl border p-4 transition-colors"
              >
                <p className="text-foreground text-sm font-medium">
                  {link.label}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {link.desc}
                </p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
