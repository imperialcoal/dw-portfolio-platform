import Link from "next/link";

import { cn } from "@dw/ui";

// ─────────────────────────────────────────────
// Tech stack data
// ─────────────────────────────────────────────

const STACK = [
  {
    category: "Frontend",
    items: ["Next.js 16", "React 19", "Tailwind CSS 4", "tRPC 11"],
  },
  {
    category: "Backend",
    items: ["Node.js", "Drizzle ORM", "PostgreSQL 16", "Upstash Redis"],
  },
  {
    category: "Platform",
    items: ["Turborepo", "pnpm workspaces", "Vercel", "QStash"],
  },
  {
    category: "Auth & Services",
    items: ["Clerk v7", "Sentry", "Resend", "Doppler"],
  },
];

const FEATURES = [
  {
    title: "AI-Powered Incident Pipeline",
    description:
      "GitHub webhooks trigger QStash jobs processed by an Anthropic-powered agent that analyzes CI failures, Sentry errors, and security alerts — creating structured incident records with root cause analysis, severity classification, and correlated GitHub issues.",
  },
  {
    title: "Platform Intelligence Dashboard",
    description:
      "A live DevOps control center surfacing incidents, deployments, database health, user activity, and security advisories. Includes one-click rollback with migration risk analysis, bidirectional incident resolution, and a ⌘K command palette.",
  },
  {
    title: "Full-Stack Monorepo Architecture",
    description:
      "Turborepo monorepo with shared packages for auth, contracts, config, validators, UI components, and the AI agent layer. Type-safe end-to-end with tRPC, Drizzle schema, and Zod validation across every boundary.",
  },
  {
    title: "Production Infrastructure",
    description:
      "Terraform-managed infrastructure on Vercel, Supabase, Cloudflare, and Upstash. Doppler for secrets management, Clerk for authentication, Sentry for observability, and Resend for transactional email.",
  },
];

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export function HomeContent() {
  return (
    <div className="bg-background min-h-screen">
      {/* Nav */}
      <nav className="border-border flex h-14 items-center justify-between border-b px-6 lg:px-10">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          DW Portfolio
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/imperialcoal/dw-portfolio-platform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            GitHub →
          </a>
          <Link
            href="/platform"
            className="bg-foreground text-background rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          >
            View Platform →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center lg:px-10 lg:pt-28">
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            Live Production System
          </Badge>
          <Badge className="border-border bg-muted/60 text-muted-foreground">
            Full-Stack TypeScript
          </Badge>
          <Badge className="border-border bg-muted/60 text-muted-foreground">
            AI-Powered DevOps
          </Badge>
        </div>

        <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Platform Intelligence
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
          A production-grade AI DevOps platform built as a portfolio project — a
          monorepo with a real-time incident pipeline, automated rollback, and a
          full-featured admin dashboard powered by Anthropic.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/platform"
            className="bg-foreground text-background rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          >
            Open Dashboard
          </Link>
          <a
            href="https://github.com/imperialcoal/dw-portfolio-platform"
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-muted/40 text-foreground hover:bg-muted/70 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            View Source
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-20 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="border-border bg-muted/30 rounded-xl border p-6"
            >
              <h3 className="text-foreground mb-2 text-base font-semibold">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section className="border-border border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-muted-foreground mb-8 text-center text-[10px] font-semibold tracking-widest uppercase">
            Technology Stack
          </p>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {STACK.map((group) => (
              <div key={group.category}>
                <p className="text-muted-foreground mb-3 text-xs font-medium">
                  {group.category}
                </p>
                <ul className="space-y-1.5">
                  {group.items.map((item) => (
                    <li key={item} className="text-foreground text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-border border-t">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center lg:px-10">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Ready to explore?
          </h2>
          <p className="text-muted-foreground mt-3">
            The platform dashboard is live with real incident data, deployment
            history, and AI-generated analysis. No setup required.
          </p>
          <Link
            href="/platform"
            className="bg-foreground text-background mt-6 inline-flex rounded-lg px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          >
            Open Platform Dashboard →
          </Link>
        </div>
      </section>
    </div>
  );
}
