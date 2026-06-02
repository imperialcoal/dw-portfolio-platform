// apps/nextjs/src/app/(admin)/platform/communications/page.tsx
import Link from "next/link";

import { env } from "~/env";

function githubUrl(path: string, repo: string) {
  return repo ? `https://github.com/${repo}/${path}` : "https://github.com";
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
                Communications
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Resend email delivery · GitHub webhooks and PRs
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors"
            >
              Resend Logs →
            </a>
            <a
              href={github("pulls")}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors"
            >
              GitHub PRs →
            </a>
          </div>
        </div>

        <div className="border-border bg-muted/40 rounded-xl border px-5 py-4">
          <p className="text-muted-foreground text-sm">
            Resend delivers incident alert emails and contact form submissions.
            GitHub webhooks receive workflow run events, issue state changes,
            and Dependabot vulnerability alerts — all of which trigger the AI
            agent pipeline. PRs are the primary delivery mechanism for
            Dependabot security and version updates.
          </p>
          {githubRepo && (
            <div className="text-muted-foreground mt-3 text-xs">
              GitHub repo: <code className="text-foreground">{githubRepo}</code>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            Resend Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {resendLinks.map((link) => (
              <a
                key={link.label}
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
                key={link.label}
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
