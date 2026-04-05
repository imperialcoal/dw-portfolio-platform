// Reads Supabase Management API for database health metrics and security advisories.
// Uses SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN (service-level management token).
// All calls are read-only. Never writes to the database from here.

import type { SupabaseAdvisory, UptimeCheckResult } from "@dw/contracts";
import { config } from "@dw/config";

const MGMT_BASE = "https://api.supabase.com/v1";

function getHeaders(): Record<string, string> {
  const token = config.supabase.SUPABASE_MANAGEMENT_TOKEN;
  return {
    Authorization: `Bearer ${token ?? ""}`,
    "Content-Type": "application/json",
  };
}

function getRef(): string {
  return config.supabase.SUPABASE_PROJECT_REF ?? "";
}

export function isSupabaseConfigured(): boolean {
  return !!(
    config.supabase.SUPABASE_MANAGEMENT_TOKEN &&
    config.supabase.SUPABASE_PROJECT_REF
  );
}

// ─────────────────────────────────────────────
// Database metrics via Supabase Management API
// ─────────────────────────────────────────────

interface SupabaseTableStats {
  name: string;
  schema: string;
  live_rows_estimate: number;
  size: string; // e.g. "8192 bytes"
  index_size: string;
}

export interface DbHealthMetrics {
  projectRef: string;
  poolerConnections: {
    active: number;
    idle: number;
    total: number;
    maxAllowed: number;
  } | null;
  tables: {
    schema: string;
    name: string;
    rowEstimate: number;
    sizeBytes: number;
  }[];
  fetchedAt: string;
}

export async function fetchDbHealth(): Promise<DbHealthMetrics | null> {
  if (!isSupabaseConfigured()) return null;

  const ref = getRef();

  try {
    // Fetch table stats — requires management API token with read access
    const tableRes = await fetch(
      `${MGMT_BASE}/projects/${ref}/database/table-sizes`,
      { headers: getHeaders() },
    );

    let tables: DbHealthMetrics["tables"] = [];

    if (tableRes.ok) {
      const data = (await tableRes.json()) as SupabaseTableStats[];
      tables = data
        .filter((t) => t.schema === "public")
        .map((t) => ({
          schema: t.schema,
          name: t.name,
          rowEstimate: t.live_rows_estimate,
          sizeBytes: parseSizeBytes(t.size),
        }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes);
    }

    // Fetch pooler/connection stats via the pooler config endpoint
    const poolerRes = await fetch(
      `${MGMT_BASE}/projects/${ref}/config/database/pgbouncer`,
      { headers: getHeaders() },
    );

    let poolerConnections: DbHealthMetrics["poolerConnections"] = null;

    if (poolerRes.ok) {
      const pooler = (await poolerRes.json()) as {
        pool_size?: number;
        max_client_conn?: number;
      };
      poolerConnections = {
        active: 0, // Would need pg_stat_activity query — not available in mgmt API
        idle: 0,
        total: pooler.pool_size ?? 0,
        maxAllowed: pooler.max_client_conn ?? 200,
      };
    }

    return {
      projectRef: ref,
      poolerConnections,
      tables,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        sensor: "supabase",
        event: "fetch_db_health_failed",
        error: String(err),
      }),
    );
    return null;
  }
}

function parseSizeBytes(sizeStr: string): number {
  // Supabase returns sizes like "8192 bytes", "1.2 MB", "456 kB"
  const match = /^([\d.]+)\s*(bytes?|kB|MB|GB)?$/i.exec(sizeStr.trim());
  if (!match) return 0;
  const value = parseFloat(match[1] ?? "0");
  const unit = (match[2] ?? "bytes").toLowerCase();
  if (unit.startsWith("gb")) return Math.round(value * 1024 * 1024 * 1024);
  if (unit.startsWith("mb")) return Math.round(value * 1024 * 1024);
  if (unit.startsWith("kb")) return Math.round(value * 1024);
  return Math.round(value);
}

// ─────────────────────────────────────────────
// Security Advisories — Supabase Security Advisor API
// GET /v1/projects/{ref}/advisors/security
// ─────────────────────────────────────────────

interface RawAdvisory {
  name?: string;
  title?: string;
  level?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function fetchSupabaseAdvisories(): Promise<SupabaseAdvisory[]> {
  if (!isSupabaseConfigured()) return [];

  const ref = getRef();

  try {
    const res = await fetch(`${MGMT_BASE}/projects/${ref}/advisors/security`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      console.warn(
        JSON.stringify({
          level: "warn",
          sensor: "supabase",
          event: "advisories_unavailable",
          status: res.status,
        }),
      );
      return [];
    }

    const data = (await res.json()) as
      | { advisories?: RawAdvisory[] }
      | RawAdvisory[];
    const raw: RawAdvisory[] = Array.isArray(data)
      ? data
      : (data.advisories ?? []);

    return raw.map(
      (a): SupabaseAdvisory => ({
        name: a.name ?? "unknown",
        title: a.title ?? a.name ?? "Security Advisory",
        level: a.level?.toUpperCase() as SupabaseAdvisory["level"],
        description: a.description ?? "",
        metadata: a.metadata,
        detectedAt: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        sensor: "supabase",
        event: "fetch_advisories_failed",
        error: String(err),
      }),
    );
    return [];
  }
}

// ─────────────────────────────────────────────
// Uptime checks — hit the app URLs and measure response time
// ─────────────────────────────────────────────

export const UPTIME_CHECKS: { name: string; url: string }[] = [
  { name: "Portfolio (Production)", url: "https://dw-portfolio.dev" },
  {
    name: "tRPC API (Production)",
    url: "https://dw-portfolio.dev/api/trpc/post.all",
  },
  {
    name: "Platform Dashboard (Preview)",
    url: "https://dev.dw-portfolio.dev/platform",
  },
];

export async function runUptimeChecks(): Promise<UptimeCheckResult[]> {
  const results = await Promise.allSettled(
    UPTIME_CHECKS.map(async (check): Promise<UptimeCheckResult> => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(check.url, {
          method: "GET",
          signal: controller.signal,
          // Don't follow Clerk auth redirects — a 307 is still "up"
          redirect: "manual",
        });
        clearTimeout(timeout);

        const elapsed = Date.now() - start;
        const status =
          res.status >= 200 && res.status < 500
            ? elapsed > 3000
              ? "degraded"
              : "up"
            : "down";

        return {
          url: check.url,
          name: check.name,
          status,
          statusCode: res.status,
          responseTimeMs: elapsed,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          url: check.url,
          name: check.name,
          status: "down",
          statusCode: null,
          responseTimeMs: Date.now() - start,
          checkedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          url: "unknown",
          name: "unknown",
          status: "down" as const,
          statusCode: null,
          responseTimeMs: null,
          checkedAt: new Date().toISOString(),
          error: "Check threw unexpectedly",
        },
  );
}
