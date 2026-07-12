"use client";

import Link from "next/link";

import { cn } from "@dw/ui";

import { ContactForm } from "~/app/_components/contact-form";

// ─────────────────────────────────────────────
// DemoHomePage
//
// The recruiter-facing landing page for Platform Intelligence.
// Rendered at / when DEMO_MODE=true in Doppler.
//
// This component owns:
//   - The nav with GitHub, LinkedIn, Auth Demo, Open Dashboard links
//   - The hero section with live system badges and headline
//   - The AI pipeline visualization
//   - The feature cards
//   - The tech stack tags
//   - The contact form section (Resend showcase + optional named-account request)
//
// Primary demo entry point: the Astro portfolio's "Try the Demo" CTA hits
// /api/demo, which mints a single-use Clerk sign-in ticket for the
// pre-provisioned DEMO_USER_CLERK_ID and redirects straight to /platform.
// No request, no waiting, no visible credentials — this is the path most
// recruiters take, and the one the portfolio site promotes.
//
// Secondary path (still supported, not removed): a recruiter who wants
// their own named account instead of the shared demo identity can still
// reach out via the contact form below. Add their email to
// RECRUITER_EMAILS in Doppler and they're auto-provisioned with the
// `recruiter` role on their next Clerk sign-up — see
// apps/nextjs/src/demo/auth/recruiter-emails.ts. This file previously had
// a "Live Demo Access" card pointing visitors at that flow directly; it's
// been removed because /api/demo is now the front door, but the contact
// form itself still works as a fallback for anyone who wants persistent,
// named access.
//
// Security note: credentials are never hardcoded here. The shared demo
// identity is a single pre-provisioned Clerk user referenced only by ID
// (DEMO_USER_CLERK_ID); named recruiter accounts are provisioned purely
// from an email allowlist. Neither path stores or displays a password.
//
// To remove demo mode entirely: delete src/demo/ and revert src/app/page.tsx.
// ─────────────────────────────────────────────

const PIPELINE_STEPS = [
  {
    trigger: "GitHub Push",
    icon: "⬡",
    description: "CI failure on dev branch",
    color: "text-zinc-400",
  },
  {
    trigger: "Webhook",
    icon: "→",
    description: "GitHub fires workflow_run event",
    color: "text-zinc-500",
  },
  {
    trigger: "QStash",
    icon: "◈",
    description: "Job enqueued with dedup key",
    color: "text-sky-400",
  },
  {
    trigger: "Anthropic",
    icon: "✦",
    description: "Claude analyzes logs + classifies",
    color: "text-violet-400",
  },
  {
    trigger: "Incident",
    icon: "●",
    description: "Redis record with root cause",
    color: "text-emerald-400",
  },
];

const STACK_ITEMS = [
  { label: "Next.js 16", category: "Frontend" },
  { label: "React 19", category: "Frontend" },
  { label: "tRPC 11", category: "API" },
  { label: "Drizzle ORM", category: "Database" },
  { label: "Supabase PG16", category: "Database" },
  { label: "Upstash Redis", category: "Cache" },
  { label: "Clerk v7", category: "Auth" },
  { label: "Anthropic SDK", category: "AI" },
  { label: "QStash", category: "Queue" },
  { label: "Terraform", category: "Infra" },
  { label: "Turborepo", category: "Monorepo" },
  { label: "Doppler", category: "Secrets" },
  { label: "Sentry", category: "Observability" },
  { label: "Vercel", category: "Deploy" },
  { label: "Cloudflare", category: "DNS" },
  { label: "Resend", category: "Email" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Frontend:
    "border-blue-500/20 bg-blue-500/8 text-blue-400 dark:bg-blue-500/10",
  API: "border-violet-500/20 bg-violet-500/8 text-violet-400 dark:bg-violet-500/10",
  Database:
    "border-emerald-500/20 bg-emerald-500/8 text-emerald-400 dark:bg-emerald-500/10",
  Cache: "border-cyan-500/20 bg-cyan-500/8 text-cyan-400 dark:bg-cyan-500/10",
  Auth: "border-amber-500/20 bg-amber-500/8 text-amber-400 dark:bg-amber-500/10",
  AI: "border-fuchsia-500/20 bg-fuchsia-500/8 text-fuchsia-400 dark:bg-fuchsia-500/10",
  Queue:
    "border-orange-500/20 bg-orange-500/8 text-orange-400 dark:bg-orange-500/10",
  Infra: "border-rose-500/20 bg-rose-500/8 text-rose-400 dark:bg-rose-500/10",
  Monorepo:
    "border-zinc-500/20 bg-zinc-500/8 text-zinc-400 dark:bg-zinc-500/10",
  Secrets: "border-lime-500/20 bg-lime-500/8 text-lime-400 dark:bg-lime-500/10",
  Observability:
    "border-pink-500/20 bg-pink-500/8 text-pink-400 dark:bg-pink-500/10",
  Deploy: "border-sky-500/20 bg-sky-500/8 text-sky-400 dark:bg-sky-500/10",
  DNS: "border-indigo-500/20 bg-indigo-500/8 text-indigo-400 dark:bg-indigo-500/10",
  Email: "border-teal-500/20 bg-teal-500/8 text-teal-400 dark:bg-teal-500/10",
};

const FEATURES = [
  {
    title: "AI Incident Pipeline",
    subtitle: "End-to-end, zero-touch",
    description:
      "GitHub, Sentry, and Dependabot webhooks trigger QStash jobs processed by an Anthropic agent. Each event gets root cause analysis, severity classification, correlated GitHub issues, and structured Redis records — without human intervention.",
    detail: "Claude 3.5 Sonnet · QStash dedup · Redis persistence",
  },
  {
    title: "Terraform-Managed Infrastructure",
    subtitle: "Six providers, two environments",
    description:
      "Preview and production environments provisioned identically via Terraform: Supabase projects, Upstash Redis databases, Vercel domains, Cloudflare DNS, and Doppler secrets. State stored in Cloudflare R2.",
    detail: "Cloudflare · Vercel · Supabase · Upstash · Doppler",
  },
  {
    title: "Monorepo Architecture",
    subtitle: "Turborepo + pnpm workspaces",
    description:
      "Shared packages for auth (Clerk RBAC), contracts (typed event schemas), validators (Zod), UI components, and the AI agent layer. Type-safe end-to-end: tRPC procedures → Drizzle schema → Zod validation.",
    detail: "16 workspace packages · Remote caching · CI/CD on every push",
  },
  {
    title: "Platform Intelligence Dashboard",
    subtitle: "Live DevOps control center",
    description:
      "Real-time incident tracking, one-click rollback with migration risk analysis, database health monitoring with RLS advisories, Clerk user activity, Sentry observability, and a ⌘K command palette.",
    detail:
      "Instant recruiter access via one-click demo sign-in · All systems live",
  },
];

export function DemoHomePage() {
  return (
    <div className="bg-background min-h-screen">
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6 lg:px-10">
          <span className="text-foreground text-sm font-semibold tracking-tight">
            DW / Platform Intelligence
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/imperialcoal/dw-portfolio-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/derrick-warren-794a2b203"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              LinkedIn
            </a>
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Auth Demo
            </Link>
            <Link
              href="/platform"
              className="bg-foreground text-background rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            >
              Open Dashboard →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 lg:px-10 lg:pt-28">
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            ● Live production system
          </span>
          <span className="border-border bg-muted/60 text-muted-foreground rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
            TypeScript monorepo
          </span>
          <span className="border-border bg-muted/60 text-muted-foreground rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
            16 workspace packages
          </span>
          <span className="border-border bg-muted/60 text-muted-foreground rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
            Terraform IaC
          </span>
        </div>

        <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
          An AI-powered DevOps platform
          <br />
          <span className="text-muted-foreground font-normal">
            built as a portfolio project
          </span>
        </h1>

        <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed">
          GitHub, Sentry, and Dependabot webhooks feed an Anthropic-powered
          incident pipeline. Two fully independent environments provisioned by
          Terraform. Real CI, real deployments, real data.
        </p>
      </section>

      {/* ── AI Pipeline visualization ─────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-widest uppercase">
            How it works
          </p>
          <h2 className="text-foreground mb-10 text-2xl font-bold tracking-tight">
            Automated incident pipeline
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.trigger} className="flex items-center gap-2">
                <div className="border-border bg-muted/30 rounded-lg border px-4 py-3">
                  <div className={cn("mb-1 font-mono text-lg", step.color)}>
                    {step.icon}
                  </div>
                  <p className="text-foreground text-xs font-semibold">
                    {step.trigger}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {step.description}
                  </p>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <span className="text-muted-foreground/40 hidden text-sm sm:block">
                    ──
                  </span>
                )}
              </div>
            ))}
          </div>

          <p className="text-muted-foreground mt-6 max-w-2xl text-sm leading-relaxed">
            Every CI failure, Sentry error, and security alert is automatically
            classified, analyzed, and stored with full context — severity, root
            cause, affected service, branch, and resolution notes. No manual
            triage. The platform dashboard surfaces all of this in real time.
          </p>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-widest uppercase">
            What's built
          </p>
          <h2 className="text-foreground mb-10 text-2xl font-bold tracking-tight">
            Production-grade from the ground up
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="border-border bg-muted/20 group hover:bg-muted/40 rounded-xl border p-6 transition-colors"
              >
                <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-widest uppercase">
                  {feature.subtitle}
                </p>
                <h3 className="text-foreground mb-3 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
                <p className="text-muted-foreground/60 mt-3 font-mono text-[11px]">
                  {feature.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack ─────────────────────────────────────────── */}
      <section className="border-border/60 border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          <p className="text-muted-foreground mb-8 text-center text-[10px] font-semibold tracking-widest uppercase">
            Full technology stack
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {STACK_ITEMS.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  CATEGORY_COLORS[item.category] ??
                    "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact (Resend showcase + optional named-account request) ──── */}
      <div id="contact">
        <ContactForm />
      </div>
    </div>
  );
}
