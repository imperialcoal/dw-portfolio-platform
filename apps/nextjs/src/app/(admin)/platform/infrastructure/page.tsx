// apps/nextjs/src/app/(admin)/platform/infrastructure/page.tsx
import Link from "next/link";

import { DEMO_TOOLTIPS, DemoDeepLink, isDemoSession } from "~/demo";

const UPSTASH_LINKS = [
  {
    label: "Redis Console",
    desc: "Browse incident data, keys, and TTLs",
    href: "https://console.upstash.com/redis",
    tooltipKey: "upstashRedis" as const,
  },
  {
    label: "Redis CLI",
    desc: "Run commands against the database",
    href: "https://console.upstash.com/redis",
    tooltipKey: "upstashRedis" as const,
  },
  {
    label: "QStash Console",
    desc: "Job queue and delivery logs",
    href: "https://console.upstash.com/qstash",
    tooltipKey: "upstashQstash" as const,
  },
  {
    label: "QStash Dead Letter Queue",
    desc: "Failed jobs awaiting inspection",
    href: "https://console.upstash.com/qstash",
    tooltipKey: "upstashQstash" as const,
  },
  {
    label: "QStash Schedules",
    desc: "Cron-triggered job schedules",
    href: "https://console.upstash.com/qstash",
    tooltipKey: "upstashQstash" as const,
  },
  {
    label: "Usage & Billing",
    desc: "Request counts, data transfer, and limits",
    href: "https://console.upstash.com",
    tooltipKey: "upstashRedis" as const,
  },
];

const DOPPLER_LINKS = [
  {
    label: "Secrets",
    desc: "View and update environment variables",
    href: "https://dashboard.doppler.com",
    tooltipKey: "doppler" as const,
  },
  {
    label: "Activity Log",
    desc: "Secret access and change history",
    href: "https://dashboard.doppler.com",
    tooltipKey: "doppler" as const,
  },
  {
    label: "Integrations",
    desc: "Vercel sync, GitHub Actions, and more",
    href: "https://dashboard.doppler.com",
    tooltipKey: "doppler" as const,
  },
  {
    label: "Access Control",
    desc: "Team members and service tokens",
    href: "https://dashboard.doppler.com",
    tooltipKey: "doppler" as const,
  },
];

// Card wrapper used for grid links — preserves label + desc layout while
// delegating the anchor vs disabled-button decision to DemoDeepLink.
// DemoDeepLink.className overrides the default so we get the card style.
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
    "border-border bg-muted/40 hover:border-border hover:bg-muted/60 rounded-xl border p-4 transition-colors";

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

export default async function InfrastructurePage() {
  const isDemo = await isDemoSession();

  const headerLinkClass =
    "border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors";

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
                Infrastructure
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Upstash Redis · Upstash QStash · Doppler
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <DemoDeepLink
              href="https://console.upstash.com/redis"
              label="Upstash Redis →"
              tooltip={DEMO_TOOLTIPS.upstashRedis}
              isDemo={isDemo}
              className={headerLinkClass}
            />
            <DemoDeepLink
              href="https://console.upstash.com/qstash"
              label="QStash →"
              tooltip={DEMO_TOOLTIPS.upstashQstash}
              isDemo={isDemo}
              className={headerLinkClass}
            />
          </div>
        </div>

        <div className="border-border bg-muted/40 rounded-xl border px-5 py-4">
          <p className="text-muted-foreground text-sm">
            Upstash Redis stores all incident records, user activity, and
            performance baselines with a 30-day TTL. QStash is the job queue
            that delivers webhook payloads to the AI agent processors with
            automatic retry and deduplication. Doppler manages all environment
            variables and syncs them to Vercel on each deployment.
          </p>
        </div>

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            Upstash Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {UPSTASH_LINKS.map((link) => (
              <LinkCard
                key={link.label}
                href={link.href}
                label={link.label}
                desc={link.desc}
                tooltip={DEMO_TOOLTIPS[link.tooltipKey]}
                isDemo={isDemo}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            Doppler Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {DOPPLER_LINKS.map((link) => (
              <LinkCard
                key={link.label}
                href={link.href}
                label={link.label}
                desc={link.desc}
                tooltip={DEMO_TOOLTIPS[link.tooltipKey]}
                isDemo={isDemo}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
