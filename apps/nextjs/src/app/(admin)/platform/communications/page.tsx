// apps/nextjs/src/app/(admin)/platform/communications/page.tsx
//
// Communications service page — Resend email delivery logs and domain
// management, plus GitHub webhook delivery history, PRs, and audit trail.
//
// No live data fetch — all links open external dashboards directly.

import Link from "next/link";

import { env } from "~/env";

function githubUrl(path: string, repo: string): string {
  if (!repo) return "https://github.com";
  return `https://github.com/${repo}/${path}`;
}

export default function CommunicationsPage() {
  const githubRepo = env.GITHUB_REPO ?? "";
  const github = (path: string) => githubUrl(path, githubRepo);

  const resendLinks = [
    {
      label: "Email Logs",
      desc: "Incident alert and contact form delivery",
      href: "https://resend.com/emails",
    },
    {
      label: "Domains",
      desc: "Domain verification and DNS records",
      href: "https://resend.com/domains",
    },
    {
      label: "API Keys",
      desc: "Manage sending credentials",
      href: "https://resend.com/api-keys",
    },
    {
      label: "Audiences",
      desc: "Contact lists and suppression",
      href: "https://resend.com/audiences",
    },
  ];

  const githubLinks = [
    {
      label: "Webhooks",
      desc: "Delivery history and failure logs",
      href: github("settings/hooks"),
    },
    {
      label: "Pull Requests",
      desc: "Open PRs including Dependabot updates",
      href: github("pulls"),
    },
    {
      label: "Dependabot PRs",
      desc: "Automated dependency update PRs",
      href: github("pulls?q=is%3Aopen+author%3Aapp%2Fdependabot"),
    },
    {
      label: "Platform-agent Issues",
      desc: "AI-created incident tracking issues",
      href: github("issues?q=label%3Aplatform-agent+is%3Aopen"),
    },
    {
      label: "Releases",
      desc: "Published releases and changelogs",
      href: github("releases"),
    },
    {
      label: "Discussions",
      desc: "Team discussions and ideas",
      href: github("discussions"),
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
                Communications
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Resend email delivery · GitHub webhooks and PRs
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Resend Logs →
            </a>
            <a
              href={github("pulls")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              GitHub PRs →
            </a>
          </div>
        </div>

        {/* Context */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="text-sm text-zinc-400">
            Resend delivers incident alert emails and contact form submissions.
            GitHub webhooks receive workflow run events, issue state changes,
            and Dependabot vulnerability alerts — all of which trigger the AI
            agent pipeline. PRs are the primary delivery mechanism for
            Dependabot security and version updates.
          </p>
          {githubRepo && (
            <div className="mt-3 text-xs text-zinc-600">
              GitHub repo: <code className="text-zinc-400">{githubRepo}</code>
            </div>
          )}
        </div>

        {/* Resend quick access */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Resend Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {resendLinks.map((link) => (
              <a
                key={link.label}
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
                key={link.label}
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
