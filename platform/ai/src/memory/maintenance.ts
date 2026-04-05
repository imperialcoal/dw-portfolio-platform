// Redis functions for user activity, maintenance mode, and performance baselines.
// Follows the same pattern as redis.ts.

import type { MaintenanceMode } from "@dw/contracts";
import { runtimeRedis } from "@dw/runtime/singletons";

// ─────────────────────────────────────────────
// Key schema additions
//
// platform:maintenance             → MaintenanceMode JSON
// ─────────────────────────────────────────────

const MAINTENANCE_KEY = "platform:maintenance";

// ─────────────────────────────────────────────
// Maintenance Mode
// ─────────────────────────────────────────────

export async function getMaintenanceMode(): Promise<MaintenanceMode | null> {
  const redis = runtimeRedis();
  try {
    const raw = await redis.get<string>(MAINTENANCE_KEY);
    if (!raw) return null;
    const parsed =
      typeof raw === "string"
        ? (JSON.parse(raw) as MaintenanceMode)
        : (raw as MaintenanceMode);
    return parsed.enabled ? parsed : null;
  } catch {
    return null;
  }
}

export async function setMaintenanceMode(mode: MaintenanceMode): Promise<void> {
  const redis = runtimeRedis();
  // No TTL — maintenance mode persists until explicitly disabled
  await redis.set(MAINTENANCE_KEY, JSON.stringify(mode));
}
