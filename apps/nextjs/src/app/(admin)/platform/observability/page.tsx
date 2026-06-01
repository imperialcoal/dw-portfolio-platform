// apps/nextjs/src/app/(admin)/platform/observability/page.tsx
//
// Observability service page — Sentry error tracking and GitHub CI, security,
// and issue management. No live data fetch; all links open external dashboards.
//
// Follows the same pattern as /platform/database and /platform/users:
// contextual summary at the top, quick access grid at the bottom.

import Link from "next/link";

import { env } from "~/env";

// ─────────────────────────────────────────────
// URL builders
// ─────────────────────────────────────────────

function sentryUrl(path: string, org: string): string {
  if (!org) return "https://sentry.io";
  return `https://sentry.io/organizations/${org}/${path}`;
}

function githubUrl(path: string, repo: string): string {
  if (!repo) return "https://github.com";
  return `https://github.com/${repo}/${path}`;
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function ObservabilityPage() {
  const sentryOrg = env.SENTRY_ORG ?? "";
  const sentryProject = env.SENTRY_PROJECT ?? "";
  const githubRepo = env.GITHUB_REPO ?? "";

  const sentry = (path: string) => sentryUrl(path, sentryOrg);
  const github = (path: string) => githubUrl(path, githubRepo);

  const sentryLinks = [
    {
      label: "Issues",
      desc: "Unresolved runtime errors",
      href: sentry(`issues/?project=${sentryProject}`),
    },
    {
      label: "Performance",
      desc: "Transaction traces and slowdowns",
      href: sentry(`performance/?project=${sentryProject}`),
    },
    {
      label: "Alerts",
      desc: "Alert rules and notification history",
      href: sentry(`alerts/rules/?project=${sentryProject}`),
    },
    {
      label: "Releases",
      desc: "Deploy tracking and regression detection",
      href: sentry(`releases/?project=${sentryProject}`),
    },
    {
      label: "Replays",
      desc: "Session replay for debugging UX flows",
      href: sentry(`replays/?project=${sentryProject}`),
    },
    {
      label: "Crons",
      desc: "Scheduled job monitoring",
      href: sentry(`crons/?project=${sentryProject}`),
    },
  ];

  const githubLinks = [
    {
      label: "Actions",
      desc: "CI workflow runs and status",
      href: github("actions"),
    },
    {
      label: "Security Alerts",
      desc: "Dependabot and code scanning",
      href: github("security"),
    },
    {
      label: "Platform Issues",
      desc: "Platform-agent created issues",
      href: github("issues?q=label%3Aplatform-agent+is%3Aopen"),
    },
    {
      label: "All Issues",
      desc: "Full GitHub issue tracker",
      href: github("issues"),
    },
    {
      label: "Workflows",
      desc: "Workflow YAML and run history",
      href: github("actions?query="),
    },
    {
      label: "Code Scanning",
      desc: "Static analysis and vulnerability results",
      href: github("security/code-scanning"),
    },
  ];

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
                Observability
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Sentry error tracking · GitHub CI and security
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={sentry(`issues/?project=${sentryProject}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Sentry Issues →
            </a>
            <a
              href={github("actions")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              GitHub Actions →
            </a>
          </div>
        </div>

        {/* Context */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="text-sm text-zinc-400">
            Sentry captures runtime errors, performance traces, and session
            replays from the Next.js application. GitHub Actions runs CI on
            every push; Dependabot monitors all dependencies for security
            vulnerabilities and automatically opens PRs for fixes.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-600">
            <span>
              Sentry org:{" "}
              <code className="text-zinc-400">
                {sentryOrg || "not configured"}
              </code>
            </span>
            <span>
              Sentry project:{" "}
              <code className="text-zinc-400">
                {sentryProject || "not configured"}
              </code>
            </span>
            <span>
              GitHub repo:{" "}
              <code className="text-zinc-400">
                {githubRepo || "not configured"}
              </code>
            </span>
          </div>
        </div>

        {/* Sentry quick access */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Sentry Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {sentryLinks.map((link) => (
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

        {/* GitHub quick access */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            GitHub Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {githubLinks.map((link) => (
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
