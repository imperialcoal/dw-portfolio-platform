// apps/nextjs/src/app/(admin)/platform/observability/page.tsx
import Link from "next/link";

import { DEMO_TOOLTIPS, DemoDeepLink, isDemoSession } from "~/demo";
import { env } from "~/env";

function sentryUrl(path: string, org: string) {
  return org
    ? `https://sentry.io/organizations/${org}/${path}`
    : "https://sentry.io";
}
function githubUrl(path: string, repo: string) {
  return repo ? `https://github.com/${repo}/${path}` : "https://github.com";
}

function LinkCard({
  href,
  label,
  desc,
  tooltip,
  isDemo,
}: {
  href: string;
  label: string;
  desc: string;
  tooltip: string;
  isDemo: boolean;
}) {
  const cardClass =
    "border-border bg-muted/40 hover:bg-muted/60 rounded-xl border p-4 transition-colors";

  if (!isDemo) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClass}
      >
        <p className="text-foreground text-sm font-medium">{label}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{desc}</p>
      </a>
    );
  }

  return (
    <DemoDeepLink
      href={href}
      label={label}
      tooltip={tooltip}
      isDemo={isDemo}
      className={cardClass}
    />
  );
}

export default async function ObservabilityPage() {
  const isDemo = await isDemoSession();

  const sentryOrg = env.SENTRY_ORG ?? "";
  const sentryProject = env.SENTRY_PROJECT ?? "";
  const githubRepo = env.GITHUB_REPO ?? "";
  const sentry = (path: string) => sentryUrl(path, sentryOrg);
  const github = (path: string) => githubUrl(path, githubRepo);

  const headerLinkClass =
    "border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors";

  const sentryLinks = [
    {
      label: "Issues",
      desc: "Unresolved runtime errors",
      href: sentry(`issues/?project=${sentryProject}`),
      tooltip: DEMO_TOOLTIPS.sentryIssues,
    },
    {
      label: "Performance",
      desc: "Transaction traces and slowdowns",
      href: sentry(`performance/?project=${sentryProject}`),
      tooltip: DEMO_TOOLTIPS.sentryPerformance,
    },
    {
      label: "Alerts",
      desc: "Alert rules and notification history",
      href: sentry(`alerts/rules/?project=${sentryProject}`),
      tooltip: DEMO_TOOLTIPS.sentryAlerts,
    },
    {
      label: "Releases",
      desc: "Deploy tracking and regression detection",
      href: sentry(`releases/?project=${sentryProject}`),
      tooltip: DEMO_TOOLTIPS.sentryAlerts,
    },
    {
      label: "Replays",
      desc: "Session replay for debugging UX flows",
      href: sentry(`replays/?project=${sentryProject}`),
      tooltip: DEMO_TOOLTIPS.sentryReplays,
    },
    {
      label: "Crons",
      desc: "Scheduled job monitoring",
      href: sentry(`crons/?project=${sentryProject}`),
      tooltip: DEMO_TOOLTIPS.sentryAlerts,
    },
  ];

  const githubLinks = [
    {
      label: "Actions",
      desc: "CI workflow runs and status",
      href: github("actions"),
      tooltip: DEMO_TOOLTIPS.githubActions,
    },
    {
      label: "Security Alerts",
      desc: "Dependabot and code scanning",
      href: github("security"),
      tooltip: DEMO_TOOLTIPS.githubSecurity,
    },
    {
      label: "Platform Issues",
      desc: "Platform-agent created issues",
      href: github("issues?q=label%3Aplatform-agent+is%3Aopen"),
      tooltip: DEMO_TOOLTIPS.githubIssues,
    },
    {
      label: "All Issues",
      desc: "Full GitHub issue tracker",
      href: github("issues"),
      tooltip: DEMO_TOOLTIPS.githubIssues,
    },
    {
      label: "Workflows",
      desc: "Workflow YAML and run history",
      href: github("actions?query="),
      tooltip: DEMO_TOOLTIPS.githubActions,
    },
    {
      label: "Code Scanning",
      desc: "Static analysis and vulnerability results",
      href: github("security/code-scanning"),
      tooltip: DEMO_TOOLTIPS.githubSecurity,
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
            <DemoDeepLink
              href={sentry(`issues/?project=${sentryProject}`)}
              label="Sentry Issues →"
              tooltip={DEMO_TOOLTIPS.sentryIssues}
              isDemo={isDemo}
              className={headerLinkClass}
            />
            <DemoDeepLink
              href={github("actions")}
              label="GitHub Actions →"
              tooltip={DEMO_TOOLTIPS.githubActions}
              isDemo={isDemo}
              className={headerLinkClass}
            />
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
              <LinkCard
                key={link.href}
                href={link.href}
                label={link.label}
                desc={link.desc}
                tooltip={link.tooltip}
                isDemo={isDemo}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            GitHub Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {githubLinks.map((link) => (
              <LinkCard
                key={link.href}
                href={link.href}
                label={link.label}
                desc={link.desc}
                tooltip={link.tooltip}
                isDemo={isDemo}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
