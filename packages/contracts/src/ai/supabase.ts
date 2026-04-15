// ─────────────────────────────────────────────
// Supabase security advisory
// ─────────────────────────────────────────────

export interface SupabaseAdvisory {
  name: string;
  title: string;
  level: "INFO" | "WARN" | "ERROR";
  description: string;
  metadata?: Record<string, unknown>;
  detectedAt: string;
}

// ─────────────────────────────────────────────
// Database metrics via Supabase Management API
// ─────────────────────────────────────────────

export interface SupabaseTableStats {
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

// ─────────────────────────────────────────────
// Security Advisories — Supabase Postgres Linter (splinter)
// GET /v1/projects/{ref}/lint
//
// This is the correct endpoint that powers the Supabase Security Advisor
// dashboard (Advisors → Security Advisor). It returns one item per affected
// entity (e.g. one entry per table with RLS disabled).
//
// The `cache_key` field on each result matches the `?id=` param in the
// Supabase dashboard URL:
//   advisors/security?id=rls_disabled_in_public_public_post
//
// NOTE: The /advisors/security endpoint returns [] for most projects —
// the actual linter data lives at /lint.
// ─────────────────────────────────────────────

export interface SupabaseRawLintResult {
  /** Check identifier, e.g. "rls_disabled_in_public" */
  name?: string;
  /** Human-readable title, e.g. "RLS Disabled in Public" */
  title?: string;
  /** "ERROR" | "WARN" | "INFO" */
  level?: string;
  /** Long-form description of the check */
  description?: string;
  /** Detail specific to this finding, e.g. "Table: public.post" */
  detail?: string;
  /** How to fix it */
  remediation?: string;
  /** Affected entity: { name, type, schema } */
  metadata?: {
    name?: string;
    type?: string;
    schema?: string;
    [key: string]: unknown;
  };
  /** Stable key matching the Supabase dashboard URL ?id= param
   *  e.g. "rls_disabled_in_public_public_post" */
  cache_key?: string;
  categories?: string[];
}
