import Link from "next/link";

import type { SupabaseAdvisory } from "@dw/contracts";
import { fetchDbHealth, fetchSupabaseAdvisories } from "@dw/ai/sensors";
import { isSupabaseConfigured, isSupabaseDbConfigured } from "@dw/validators";

import { env } from "~/env";
import { SyncAdvisoriesButton } from "./_components/sync-advisories-button";

// Force dynamic rendering — this page calls the Supabase Management API
// and Redis on every request. Without this, Next.js prerenders it at build
// time and serves stale HTML (cache: PRERENDER) on all subsequent requests.
export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const ADVISORY_LEVEL_STYLES = {
  ERROR: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Error",
  },
  WARN: {
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    label: "Warning",
  },
  INFO: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "Info",
  },
} as const;

export default async function DatabasePage() {
  const configured = isSupabaseConfigured();
  const dbConfigured = isSupabaseDbConfigured();

  const [health, advisoryResult] = await Promise.all([
    configured ? fetchDbHealth() : Promise.resolve(null),
    dbConfigured
      ? fetchSupabaseAdvisories().then(
          (data) => ({ ok: true as const, data }),
          (err: unknown) => ({
            ok: false as const,
            error: err instanceof Error ? err.message : "Unknown error",
          }),
        )
      : Promise.resolve({ ok: true as const, data: [] as SupabaseAdvisory[] }),
  ]);

  const advisories = advisoryResult.ok ? advisoryResult.data : [];
  const advisoryFetchError = advisoryResult.ok ? null : advisoryResult.error;

  const supabaseRef = env.SUPABASE_PROJECT_REF ?? "";

  const supabaseLinks = [
    {
      label: "SQL Editor",
      desc: "Run diagnostic queries",
      href: `https://supabase.com/dashboard/project/${supabaseRef}/sql/new`,
    },
    {
      label: "Table Editor",
      desc: "Browse and edit data safely",
      href: `https://supabase.com/dashboard/project/${supabaseRef}/editor`,
    },
    {
      label: "Database Logs",
      desc: "Postgres error and query logs",
      href: `https://supabase.com/dashboard/project/${supabaseRef}/logs/postgres-logs`,
    },
    {
      label: "API Docs",
      desc: "Auto-generated REST endpoints",
      href: `https://supabase.com/dashboard/project/${supabaseRef}/api`,
    },
    {
      label: "Auth Settings",
      desc: "RLS, providers, rate limits",
      href: `https://supabase.com/dashboard/project/${supabaseRef}/auth`,
    },
    {
      label: "Storage",
      desc: "Buckets and file management",
      href: `https://supabase.com/dashboard/project/${supabaseRef}/storage/buckets`,
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
                Database Health
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Supabase · PostgreSQL 16 ·{" "}
                {supabaseRef || "project not configured"}
              </p>
            </div>
          </div>
          <a
            href={`https://supabase.com/dashboard/project/${supabaseRef}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Supabase Studio →
          </a>
        </div>

        {!configured ? (
          // Management API not configured — fetchDbHealth returns null
          // Note: advisories are independent (use dbConfigured/DATABASE_URL)
          // and will show their own empty state below if dbConfigured is also false
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-zinc-500">
              Supabase management API not configured.
            </p>
            <p className="mt-1 text-xs text-zinc-700">
              Set <code className="font-mono">SUPABASE_PROJECT_REF</code> and{" "}
              <code className="font-mono">SUPABASE_ACCESS_TOKEN</code> in
              Doppler.
            </p>
          </div>
        ) : (
          <>
            {/* Security Advisories */}
            {advisoryFetchError !== null ? (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-400" />
                    <p className="text-sm font-medium text-yellow-400">
                      Could not fetch security advisories
                    </p>
                  </div>
                  <SyncAdvisoriesButton />
                </div>
                <p className="mt-1 font-mono text-xs text-zinc-600">
                  {advisoryFetchError}
                </p>
                <p className="mt-1 text-xs text-zinc-700">
                  Check that{" "}
                  <code className="font-mono">SUPABASE_ACCESS_TOKEN</code> is
                  set and has Management API access.
                </p>
              </div>
            ) : advisories.length > 0 ? (
              <div>
                {/* Section header with count and sync button side by side */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                    Security Advisories
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                      {advisories.length}
                    </span>
                  </h2>
                  {/* Push to incidents pipeline with one click */}
                  <SyncAdvisoriesButton />
                </div>
                <div className="space-y-3">
                  {advisories.map((advisory) => {
                    const style = ADVISORY_LEVEL_STYLES[advisory.level];
                    // advisory.name is the cache_key from the linter,
                    // e.g. "rls_disabled_in_public_public_post"
                    const preset =
                      advisory.level === "ERROR"
                        ? "ERROR"
                        : advisory.level === "WARN"
                          ? "WARN"
                          : "INFO";
                    const advisoryUrl = `https://supabase.com/dashboard/project/${supabaseRef}/advisors/security?preset=${preset}&id=${advisory.name}`;
                    return (
                      <div
                        key={advisory.name}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}
                              >
                                {style.label}
                              </span>
                              <span className="text-sm font-medium text-zinc-200">
                                {advisory.title}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-zinc-500">
                              {advisory.description}
                            </p>
                          </div>
                          <a
                            href={advisoryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
                          >
                            View →
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <p className="text-sm font-medium text-emerald-400">
                      No security advisories
                    </p>
                  </div>
                  {/* Still show sync button even when clean — idempotent */}
                  <SyncAdvisoriesButton />
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Supabase Security Advisor found no issues
                </p>
              </div>
            )}

            {/* Table sizes */}
            {health !== null && health.tables.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                    Tables
                  </h2>
                  <span className="text-[10px] text-zinc-700">
                    Updated {new Date(health.fetchedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                          Table
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                          Rows (est.)
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                          Size
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.tables.map((table) => (
                        <tr
                          key={`${table.schema}.${table.name}`}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                            {table.name}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-zinc-400 tabular-nums">
                            {table.rowEstimate.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-zinc-400 tabular-nums">
                            {formatBytes(table.sizeBytes)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`https://supabase.com/dashboard/project/${supabaseRef}/editor`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
                            >
                              Open →
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pooler info */}
            {health?.poolerConnections !== null &&
              health?.poolerConnections !== undefined && (
                <div>
                  <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                    Connection Pooler (PgBouncer)
                  </h2>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                        Pool Size
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                        {health.poolerConnections.total}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                        Max Clients
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                        {health.poolerConnections.maxAllowed}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </>
        )}

        {/* Supabase deep-links */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Supabase Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {supabaseLinks.map((link) => (
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
