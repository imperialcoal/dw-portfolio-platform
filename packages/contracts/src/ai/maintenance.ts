// ─────────────────────────────────────────────
// Maintenance mode
// platform:maintenance → MaintenanceMode | null
// ─────────────────────────────────────────────

export interface MaintenanceMode {
  enabled: boolean;
  message: string;
  enabledAt: string;
  enabledBy: string;
}
