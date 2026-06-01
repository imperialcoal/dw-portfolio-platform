// apps/nextjs/src/app/(admin)/platform/infrastructure/page.tsx
//
// Infrastructure service page — Upstash Redis (incident storage), Upstash
// QStash (job queue), and Doppler (secrets management).
//
// No live data fetch — all links open external dashboards directly.

import Link from "next/link";

const UPSTASH_LINKS = [
  {
    label: "Redis Console",
    desc: "Browse incident data, keys, and TTLs",
    href: "https://console.upstash.com/redis",
  },
  {
    label: "Redis CLI",
    desc: "Run commands against the database",
    href: "https://console.upstash.com/redis",
  },
  {
    label: "QStash Console",
    desc: "Job queue and delivery logs",
    href: "https://console.upstash.com/qstash",
  },
  {
    label: "QStash Dead Letter Queue",
    desc: "Failed jobs awaiting inspection",
    href: "https://console.upstash.com/qstash",
  },
  {
    label: "QStash Schedules",
    desc: "Cron-triggered job schedules",
    href: "https://console.upstash.com/qstash",
  },
  {
    label: "Usage & Billing",
    desc: "Request counts, data transfer, and limits",
    href: "https://console.upstash.com",
  },
];

const DOPPLER_LINKS = [
  {
    label: "Secrets",
    desc: "View and update environment variables",
    href: "https://dashboard.doppler.com",
  },
  {
    label: "Activity Log",
    desc: "Secret access and change history",
    href: "https://dashboard.doppler.com",
  },
  {
    label: "Integrations",
    desc: "Vercel sync, GitHub Actions, and more",
    href: "https://dashboard.doppler.com",
  },
  {
    label: "Access Control",
    desc: "Team members and service tokens",
    href: "https://dashboard.doppler.com",
  },
];

export default function InfrastructurePage() {
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
                Infrastructure
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Upstash Redis · Upstash QStash · Doppler
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href="https://console.upstash.com/redis"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Upstash Redis →
            </a>
            <a
              href="https://console.upstash.com/qstash"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              QStash →
            </a>
          </div>
        </div>

        {/* Context */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="text-sm text-zinc-400">
            Upstash Redis stores all incident records, user activity, and
            performance baselines with a 30-day TTL. QStash is the job queue
            that delivers webhook payloads to the AI agent processors with
            automatic retry and deduplication. Doppler manages all environment
            variables and syncs them to Vercel on each deployment.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-zinc-600">Redis TTL</p>
              <p className="mt-0.5 font-medium text-zinc-400">30 days</p>
            </div>
            <div>
              <p className="text-zinc-600">QStash retries</p>
              <p className="mt-0.5 font-medium text-zinc-400">3 attempts</p>
            </div>
            <div>
              <p className="text-zinc-600">Secrets source</p>
              <p className="mt-0.5 font-medium text-zinc-400">
                Doppler → Vercel
              </p>
            </div>
          </div>
        </div>

        {/* Upstash quick access */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Upstash Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {UPSTASH_LINKS.map((link) => (
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

        {/* Doppler quick access */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Doppler Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {DOPPLER_LINKS.map((link) => (
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
