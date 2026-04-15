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

// ─────────────────────────────────────────────
// Check definitions — paths only, no full URLs
//
// Each check specifies:
//   path      — appended to the base domain URL
//   name      — human-readable label for the dashboard
//   critical  — true → CRITICAL severity if down; false → HIGH
//   envs      — which APP_ENV values run this check
//               omit to run in all envs (except local/test which always skip)
// ─────────────────────────────────────────────

export interface CheckDefinition {
  path: string;
  name: string;
  critical: boolean;
  envs?: ("preview" | "production")[];
}
