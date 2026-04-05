// ─────────────────────────────────────────────
// Uptime check result
// ─────────────────────────────────────────────

export interface UptimeCheckResult {
  url: string;
  name: string;
  status: "up" | "down" | "degraded";
  statusCode: number | null;
  responseTimeMs: number | null;
  checkedAt: string;
  error?: string;
}
