// ─────────────────────────────────────────────
// Performance baseline
// platform:perf:baseline:{route}  → PerfBaseline (7d TTL)
// platform:perf:rolling:{route}   → list of durations (last 50 samples)
// ─────────────────────────────────────────────

export interface PerfBaseline {
  route: string;
  p50Ms: number;
  p95Ms: number;
  sampleCount: number;
  capturedAt: string;
  deploymentId?: string;
}
