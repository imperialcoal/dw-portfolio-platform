// Redis functions for performance baselines.
// Follows the same pattern as redis.ts.

import type { PerfBaseline } from "@dw/contracts";
import { runtimeRedis } from "@dw/runtime/singletons";

const PERF_BASELINE_KEY = (route: string) =>
  `platform:perf:baseline:${route.replace(/\//g, "_")}`;
const PERF_ROLLING_KEY = (route: string) =>
  `platform:perf:rolling:${route.replace(/\//g, "_")}`;
const MAX_PERF_SAMPLES = 100;
const PERF_TTL = 60 * 60 * 24 * 7; // 7d

export async function recordPerfSample(
  route: string,
  durationMs: number,
): Promise<void> {
  const redis = runtimeRedis();
  const key = PERF_ROLLING_KEY(route);
  await redis.lpush(key, String(durationMs));
  await redis.ltrim(key, 0, MAX_PERF_SAMPLES - 1);
  await redis.expire(key, PERF_TTL);
}

export async function getPerfBaseline(
  route: string,
): Promise<PerfBaseline | null> {
  const redis = runtimeRedis();
  try {
    const raw = await redis.get<string>(PERF_BASELINE_KEY(route));
    if (!raw) return null;
    // raw is always string here — get<string> returns string | null,
    // null is handled above, so JSON.parse is always correct.
    return JSON.parse(raw) as PerfBaseline;
  } catch {
    return null;
  }
}

export async function setPerfBaseline(baseline: PerfBaseline): Promise<void> {
  const redis = runtimeRedis();
  await redis.set(PERF_BASELINE_KEY(baseline.route), JSON.stringify(baseline), {
    ex: PERF_TTL,
  });
}

export async function getRollingPerf(
  route: string,
  limit = 50,
): Promise<number[]> {
  const redis = runtimeRedis();
  const raw = await redis.lrange(PERF_ROLLING_KEY(route), 0, limit - 1);
  return raw
    .map((v) => parseInt(typeof v === "string" ? v : String(v), 10))
    .filter((n) => !isNaN(n));
}

export function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}
