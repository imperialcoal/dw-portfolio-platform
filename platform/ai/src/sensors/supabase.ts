// platform/ai/src/sensors/supabase.ts
//
// Reads the Supabase Management API for database health metrics,
// and queries the database directly for security advisories.
//
// Authentication:
//   fetchDbHealth          → SUPABASE_ACCESS_TOKEN (Management API, account-scoped)
//   fetchSupabaseAdvisories → DATABASE_URL via getDb() (service_role, project-scoped)
//
// The /lint Management API endpoint is unreliable from Vercel serverless
// functions with Personal Access Tokens — it hangs without responding.
// Security advisories are instead derived directly from Postgres system
// tables, mirroring the exact checks the Supabase Security Advisor runs.

import type {
  DbHealthMetrics,
  SupabaseAdvisory,
  SupabaseTableStats,
} from "@dw/contracts";
import { config } from "@dw/config";
import { getDb, sql } from "@dw/db";
import { isSupabaseConfigured, isSupabaseDbConfigured } from "@dw/validators";

const MGMT_BASE = "https://api.supabase.com/v1";

function getHeaders(): Record<string, string> {
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
// Database health (Management API)
// ─────────────────────────────────────────────

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
// Security Advisories — direct SQL via Drizzle
//
// Mirrors the two checks the Supabase Security Advisor (splinter/pglint) runs:
//
//   Check 1: RLS disabled on public tables  → ERROR
//   Check 2: Anon role has data-access grants → WARN
//
// IMPORTANT — privilege filter:
// Postgres automatically grants REFERENCES and TRIGGER to all roles on
// every table. These are structural grants (for FK constraints and trigger
// definitions), not data access grants. The Supabase Security Advisor
// only flags SELECT, INSERT, UPDATE, DELETE — the grants that allow
// reading or modifying row data via PostgREST.
//
// Flagging REFERENCES and TRIGGER produces false positives that can never
// be resolved without breaking Postgres internals. We filter them out to
// match the actual advisor behavior.
// ─────────────────────────────────────────────

// The only privileges that represent actual data exposure via PostgREST.
// REFERENCES and TRIGGER are structural Postgres grants — not data access.
const DATA_ACCESS_PRIVILEGES = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
]);

export async function fetchSupabaseAdvisories(): Promise<SupabaseAdvisory[]> {
  if (!isSupabaseDbConfigured()) {
    console.log(
      JSON.stringify({
        level: "info",
        sensor: "supabase",
        event: "advisories_skipped",
        reason: "DATABASE_URL or SUPABASE_SECRET_DEFAULT_KEY not configured",
      }),
    );
    return [];
  }

  const now = new Date().toISOString();
  const advisories: SupabaseAdvisory[] = [];

  console.log(
    JSON.stringify({
      level: "info",
      sensor: "supabase",
      event: "advisories_fetch_start",
      method: "sql",
    }),
  );

  try {
    const db = getDb();

    // ── Check 1: RLS disabled on public tables ──────────────────────────────
    const rlsRows = (await db.execute(
      sql`SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false`,
    )) as { schemaname: string; tablename: string }[];

    for (const row of rlsRows) {
      const entity = `${row.schemaname}.${row.tablename}`;
      advisories.push({
        name: `rls_disabled_in_public_${row.schemaname}_${row.tablename}`,
        title: "RLS Disabled in Public",
        level: "ERROR",
        description: `Table \`${entity}\` is public but RLS has not been enabled. Detects cases where row level security has not been enabled on tables in schemas exposed to PostgREST · Affected: ${entity}`,
        metadata: {
          schema: row.schemaname,
          name: row.tablename,
          type: "table",
        },
        detectedAt: now,
      });
    }

    // ── Check 2: Anon role has data-access grants ──────────────────────────
    //
    // Filter to only SELECT, INSERT, UPDATE, DELETE, TRUNCATE.
    // REFERENCES and TRIGGER are Postgres structural defaults — not data access.
    // Including them would produce false positives that can never be resolved.
    const anonRows = (await db.execute(
      sql`
        SELECT table_schema, table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE grantee = 'anon'
          AND table_schema = 'public'
          AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
        ORDER BY table_name, privilege_type
      `,
    )) as {
      table_schema: string;
      table_name: string;
      privilege_type: string;
    }[];

    const anonTables = new Map<string, string[]>();
    for (const row of anonRows) {
      const key = `${row.table_schema}.${row.table_name}`;
      const privs = anonTables.get(key) ?? [];
      // Belt-and-suspenders: also filter in JS in case DB returns unexpected values
      if (DATA_ACCESS_PRIVILEGES.has(row.privilege_type)) {
        privs.push(row.privilege_type);
        anonTables.set(key, privs);
      }
    }

    for (const [table, privs] of anonTables) {
      advisories.push({
        name: `anon_access_${table.replace(".", "_")}`,
        title: "Exposed to Anon Role",
        level: "WARN",
        description: `The anon role has ${privs.join(", ")} access on \`${table}\`. All unauthenticated PostgREST requests run as anon — verify this exposure is intentional · Affected: ${table}`,
        metadata: { table, privileges: privs },
        detectedAt: now,
      });
    }

    console.log(
      JSON.stringify({
        level: "info",
        sensor: "supabase",
        event: "advisories_parsed",
        total: advisories.length,
        method: "sql",
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
    throw err;
  }
}
