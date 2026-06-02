// apps/nextjs/src/app/(admin)/platform/observability/page.tsx
import Link from "next/link";

import { env } from "~/env";

function sentryUrl(path: string, org: string) {
  return org
    ? `https://sentry.io/organizations/${org}/${path}`
    : "https://sentry.io";
}
function githubUrl(path: string, repo: string) {
  return repo ? `https://github.com/${repo}/${path}` : "https://github.com";
}

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
                Observability
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Sentry error tracking · GitHub CI and security
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={sentry(`issues/?project=${sentryProject}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors"
            >
              Sentry Issues →
            </a>
            <a
              href={github("actions")}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors"
            >
              GitHub Actions →
            </a>
          </div>
        </div>

        <div className="border-border bg-muted/40 rounded-xl border px-5 py-4">
          <p className="text-muted-foreground text-sm">
            Sentry captures runtime errors, performance traces, and session
            replays from the Next.js application. GitHub Actions runs CI on
            every push; Dependabot monitors all dependencies for security
            vulnerabilities and automatically opens PRs for fixes.
          </p>
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
            <span>
              Sentry org:{" "}
              <code className="text-foreground">
                {sentryOrg || "not configured"}
              </code>
            </span>
            <span>
              Sentry project:{" "}
              <code className="text-foreground">
                {sentryProject || "not configured"}
              </code>
            </span>
            <span>
              GitHub repo:{" "}
              <code className="text-foreground">
                {githubRepo || "not configured"}
              </code>
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            Sentry Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {sentryLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-muted/40 hover:bg-muted/60 rounded-xl border p-4 transition-colors"
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

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            GitHub Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {githubLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-muted/40 hover:bg-muted/60 rounded-xl border p-4 transition-colors"
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
