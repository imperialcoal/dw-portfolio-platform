// ─────────────────────────────────────────────
// System health snapshot — for dashboard header
// ─────────────────────────────────────────────
export interface SystemHealth {
  lastChecked: string;
  incidentCount24h: number;
  criticalCount: number;
  recentSeverity: "critical" | "high" | "medium" | "low" | "healthy";
}
