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
