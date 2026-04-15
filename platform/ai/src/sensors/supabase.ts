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

import type { SupabaseAdvisory } from "@dw/contracts";
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

// ─────────────────────────────────────────────
// Security Advisories — Supabase Security Advisor API
// GET /v1/projects/{ref}/advisors/security
// ─────────────────────────────────────────────

interface RawAdvisoryResult {
  name?: string;
  [key: string]: unknown;
}

interface RawAdvisory {
  name?: string;
  title?: string;
  level?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  // The linter API returns affected items in a `results` array
  results?: RawAdvisoryResult[];
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
        ref: ref.slice(0, 8) + "...",
        hasToken: !!config.supabase.SUPABASE_ACCESS_TOKEN,
        tokenPrefix:
          config.supabase.SUPABASE_ACCESS_TOKEN?.slice(0, 8) ?? "unset",
      }),
    );

    const res = await fetch(`${MGMT_BASE}/projects/${ref}/advisors/security`, {
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

    const data = (await res.json()) as
      | { advisories?: RawAdvisory[] }
      | RawAdvisory[];
    const raw: RawAdvisory[] = Array.isArray(data)
      ? data
      : (data.advisories ?? []);

    // Log the raw response shape for diagnostics (truncated to avoid log bloat)
    console.log(
      JSON.stringify({
        level: "info",
        sensor: "supabase",
        event: "advisories_raw",
        count: raw.length,
        // Log first item keys and level to understand the shape
        firstItemKeys: raw[0] ? Object.keys(raw[0]) : [],
        firstItemLevel: raw[0]?.level,
        firstItemName: raw[0]?.name,
        firstItemResultsCount: raw[0]?.results?.length ?? 0,
      }),
    );

    // Expand: if a check has a `results` array, emit one advisory per affected item.
    // If no results array (or empty), emit one advisory for the check itself.
    const expanded: SupabaseAdvisory[] = [];

    for (const a of raw) {
      const level = (a.level?.toUpperCase() ??
        "WARN") as SupabaseAdvisory["level"];
      const baseTitle = a.title ?? a.name ?? "Security Advisory";
      const description = a.description ?? "";

      if (a.results && a.results.length > 0) {
        for (const result of a.results) {
          const resultName = result.name ?? "unknown";
          expanded.push({
            // Use check name + result name as stable unique identifier
            name: `${a.name ?? "advisory"}-${resultName}`,
            title: baseTitle,
            level,
            description: `${description}${description ? " · " : ""}Affected: ${resultName}`,
            metadata: { ...a.metadata, affectedItem: resultName },
            detectedAt: new Date().toISOString(),
          });
        }
      } else {
        expanded.push({
          name: a.name ?? "unknown",
          title: baseTitle,
          level,
          description,
          metadata: a.metadata,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    console.log(
      JSON.stringify({
        level: "info",
        sensor: "supabase",
        event: "advisories_parsed",
        rawChecks: raw.length,
        expandedAdvisories: expanded.length,
        levels: expanded.map((a) => a.level),
      }),
    );

    return expanded;
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
