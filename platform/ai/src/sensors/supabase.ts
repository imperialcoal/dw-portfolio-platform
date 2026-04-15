// Reads the Supabase Management API for database health metrics and security advisories.
//
// Authentication:
//   SUPABASE_ACCESS_TOKEN — Personal Access Token (same one used by Terraform)
//   Authenticates against: https://api.supabase.com/v1
//
// NOT the service_role key (SUPABASE_SECRET_DEFAULT_KEY) — that only works
// against the project's PostgREST endpoint (project-ref.supabase.co).
//
// All calls are read-only. Never writes to the database.

import type {
  DbHealthMetrics,
  SupabaseAdvisory,
  SupabaseRawLintResult,
  SupabaseTableStats,
} from "@dw/contracts";
import { config } from "@dw/config";
import { isSupabaseConfigured } from "@dw/validators";

const MGMT_BASE = "https://api.supabase.com/v1";

function getHeaders(): Record<string, string> {
  // Use SUPABASE_ACCESS_TOKEN (Personal Access Token) for the Management API.
  // This is the same token used by Terraform — it's account-scoped and
  // authenticates against api.supabase.com, not the project URL.
  const token = config.supabase.SUPABASE_ACCESS_TOKEN;
  return {
    Authorization: `Bearer ${token ?? ""}`,
    "Content-Type": "application/json",
  };
}

function getRef(): string {
  return config.supabase.SUPABASE_PROJECT_REF ?? "";
}

export async function fetchDbHealth(): Promise<DbHealthMetrics | null> {
  if (!isSupabaseConfigured()) return null;

  const ref = getRef();

  try {
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
        active: 0,
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
  const match = /^([\d.]+)\s*(bytes?|kB|MB|GB)?$/i.exec(sizeStr.trim());
  if (!match) return 0;
  const value = parseFloat(match[1] ?? "0");
  const unit = (match[2] ?? "bytes").toLowerCase();
  if (unit.startsWith("gb")) return Math.round(value * 1024 * 1024 * 1024);
  if (unit.startsWith("mb")) return Math.round(value * 1024 * 1024);
  if (unit.startsWith("kb")) return Math.round(value * 1024);
  return Math.round(value);
}

export async function fetchSupabaseAdvisories(): Promise<SupabaseAdvisory[]> {
  if (!isSupabaseConfigured()) return [];

  const ref = getRef();

  try {
    console.log(
      JSON.stringify({
        level: "info",
        sensor: "supabase",
        event: "advisories_fetch_start",
        endpoint: "lint",
        ref: ref.slice(0, 8) + "...",
        hasToken: !!config.supabase.SUPABASE_ACCESS_TOKEN,
        tokenPrefix:
          config.supabase.SUPABASE_ACCESS_TOKEN?.slice(0, 8) ?? "unset",
      }),
    );

    // /lint is the Postgres linter (splinter) endpoint — powers Security Advisor
    const res = await fetch(`${MGMT_BASE}/projects/${ref}/lint`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await res.json();
      } catch {
        // body wasn't JSON — ignore
      }

      console.warn(
        JSON.stringify({
          level: "warn",
          sensor: "supabase",
          event: "advisories_unavailable",
          status: res.status,
          error: errorBody,
          tokenPrefix:
            config.supabase.SUPABASE_ACCESS_TOKEN?.slice(0, 8) ?? "unset",
        }),
      );
      return [];
    }

    const raw = (await res.json()) as SupabaseRawLintResult[];

    console.log(
      JSON.stringify({
        level: "info",
        sensor: "supabase",
        event: "lint_raw",
        isArray: Array.isArray(raw),
        count: Array.isArray(raw) ? raw.length : 0,
        firstItemKeys: Array.isArray(raw) && raw[0] ? Object.keys(raw[0]) : [],
        firstItemLevel: Array.isArray(raw) ? (raw[0]?.level ?? null) : null,
        firstItemName: Array.isArray(raw) ? (raw[0]?.name ?? null) : null,
        firstCacheKey: Array.isArray(raw) ? (raw[0]?.cache_key ?? null) : null,
      }),
    );

    if (!Array.isArray(raw)) {
      console.warn(
        JSON.stringify({
          level: "warn",
          sensor: "supabase",
          event: "lint_unexpected_shape",
          received: typeof raw,
        }),
      );
      return [];
    }

    const advisories: SupabaseAdvisory[] = raw.map((r) => {
      const entity =
        r.metadata?.schema && r.metadata.name
          ? `${r.metadata.schema}.${r.metadata.name}`
          : (r.detail ?? "");

      const description = [r.description, entity ? `Affected: ${entity}` : ""]
        .filter(Boolean)
        .join(" · ");

      return {
        // cache_key matches the Supabase dashboard URL ?id= param — use as stable ID
        name:
          r.cache_key ??
          `${r.name ?? "advisory"}-${entity.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
        title: r.title ?? r.name ?? "Security Advisory",
        level: (r.level?.toUpperCase() ?? "WARN") as SupabaseAdvisory["level"],
        description,
        metadata: {
          ...r.metadata,
          cacheKey: r.cache_key,
          detail: r.detail,
          remediation: r.remediation,
          categories: r.categories,
        },
        detectedAt: new Date().toISOString(),
      };
    });

    console.log(
      JSON.stringify({
        level: "info",
        sensor: "supabase",
        event: "advisories_parsed",
        total: advisories.length,
        levels: advisories.reduce<Record<string, number>>((acc, a) => {
          acc[a.level] = (acc[a.level] ?? 0) + 1;
          return acc;
        }, {}),
        names: advisories.map((a) => a.name),
      }),
    );

    return advisories;
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
