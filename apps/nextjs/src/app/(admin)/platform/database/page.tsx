import Link from "next/link";

import type { SupabaseAdvisory } from "@dw/contracts";
import { fetchDbHealth, fetchSupabaseAdvisories } from "@dw/ai/sensors";
import { isSupabaseConfigured, isSupabaseDbConfigured } from "@dw/validators";

import { env } from "~/env";
import { SyncAdvisoriesButton } from "./_components/sync-advisories-button";

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
                Database Health
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Supabase · PostgreSQL 16 ·{" "}
                {supabaseRef || "project not configured"}
              </p>
            </div>
          </div>
          <a
            href={`https://supabase.com/dashboard/project/${supabaseRef}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors"
          >
            Supabase Studio →
          </a>
        </div>

        {!configured ? (
          <div className="border-border bg-muted/40 rounded-xl border p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Supabase is not configured.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Add SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF to Doppler to
              enable database health monitoring.
            </p>
          </div>
        ) : (
          <>
            {health !== null && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="border-border bg-muted/40 rounded-xl border p-5">
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
                    Tables
                  </p>
                  <p className="text-foreground text-3xl font-bold tabular-nums">
                    {health.tables.length}
                  </p>
                </div>
                <div className="border-border bg-muted/40 rounded-xl border p-5">
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
                    Advisories
                  </p>
                  <p
                    className={`text-3xl font-bold tabular-nums ${advisories.length > 0 ? "text-yellow-400" : "text-emerald-400"}`}
                  >
                    {advisories.length}
                  </p>
                </div>
                {health.poolerConnections !== null && (
                  <>
                    <div className="border-border bg-muted/40 rounded-xl border p-5">
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
                        Active Connections
                      </p>
                      <p className="text-foreground text-3xl font-bold tabular-nums">
                        {health.poolerConnections.active}
                      </p>
                    </div>
                    <div className="border-border bg-muted/40 rounded-xl border p-5">
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
                        Max Clients
                      </p>
                      <p className="text-foreground text-3xl font-bold tabular-nums">
                        {health.poolerConnections.maxAllowed}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Advisories */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
                  Security Advisories
                </h2>
                <SyncAdvisoriesButton />
              </div>
              {advisoryFetchError !== null ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-xs text-red-400">
                    Failed to fetch advisories: {advisoryFetchError}
                  </p>
                </div>
              ) : advisories.length === 0 ? (
                <div className="border-border bg-muted/40 rounded-xl border p-6 text-center">
                  <p className="text-sm font-medium text-emerald-500">
                    ✓ No advisories
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Supabase Security Advisor found no issues
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {advisories.map((advisory, i) => {
                    const style = ADVISORY_LEVEL_STYLES[advisory.level];
                    return (
                      <div
                        key={i}
                        className="border-border bg-muted/40 rounded-xl border p-4"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
                          >
                            {style.label}
                          </span>
                          <p className="text-foreground text-sm font-medium">
                            {advisory.title}
                          </p>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {advisory.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tables */}
            {health !== null && health.tables.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
                    Tables
                  </h2>
                  <span className="text-muted-foreground text-[10px]">
                    Updated {new Date(health.fetchedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="border-border bg-muted/40 overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border border-b">
                        <th className="text-muted-foreground px-4 py-3 text-left text-[10px] font-semibold tracking-widest uppercase">
                          Table
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-right text-[10px] font-semibold tracking-widest uppercase">
                          Rows (est.)
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-right text-[10px] font-semibold tracking-widest uppercase">
                          Size
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-right text-[10px] font-semibold tracking-widest uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.tables.map((table) => (
                        <tr
                          key={`${table.schema}.${table.name}`}
                          className="border-border border-b last:border-0"
                        >
                          <td className="text-foreground px-4 py-3 font-mono text-xs">
                            {table.name}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-right text-xs tabular-nums">
                            {table.rowEstimate.toLocaleString()}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-right text-xs tabular-nums">
                            {formatBytes(table.sizeBytes)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`https://supabase.com/dashboard/project/${supabaseRef}/editor`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                            >
                              Browse →
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Supabase Quick Access */}
        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            Supabase Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {supabaseLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-muted/40 hover:border-border hover:bg-muted/60 rounded-xl border p-4 transition-colors"
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
