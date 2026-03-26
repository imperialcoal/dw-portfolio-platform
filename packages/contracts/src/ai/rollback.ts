// ─────────────────────────────────────────────
// Migration monitoring and rollback safety types
// ─────────────────────────────────────────────

export type MigrationOperationType = "safe" | "risky" | "destructive";

export interface MigrationOperation {
  type: MigrationOperationType;
  /** The SQL statement (truncated to first 200 chars for display) */
  statement: string;
  /** The table affected, if detectable */
  table: string | null;
  /** Human-readable description of the operation */
  description: string;
}

export interface MigrationFile {
  path: string;
  operations: MigrationOperation[];
  /** Overall risk level — worst case of all operations in this file */
  riskLevel: MigrationOperationType;
}

export interface RollbackPreflight {
  deploymentId: string;
  commitSha: string;
  /** True if the deployment's commit contains any migration files */
  hasMigrations: boolean;
  /** Parsed migration files with classified operations */
  migrations: MigrationFile[];
  /**
   * Overall risk level across all migrations.
   * "safe"        → rollback freely
   * "risky"       → warn and require acknowledgment
   * "destructive" → hard warning, require typing "ROLLBACK" to confirm
   */
  overallRisk: MigrationOperationType;
  /** Summary sentence for display */
  summary: string;
}

export interface RollbackResult {
  success: boolean;
  /** New deployment URL if successful */
  deploymentUrl?: string;
  /** New deployment ID */
  newDeploymentId?: string;
  error?: string;
}

// ─────────────────────────────────────────────
// Rollback audit record — persisted in Redis
//
// Written by the execute route before + after the Vercel API call.
// Provides a full audit trail visible on the deployments page.
//
// Lifecycle:
//   pending   → record written, about to call Vercel
//   executing → Vercel API called, awaiting response
//   success   → Vercel promoted deployment successfully
//   failed    → Vercel API call failed or returned error
// ─────────────────────────────────────────────

export interface RollbackRecord {
  /** The deployment being rolled back FROM (currently live) */
  deploymentId: string;
  /** The commit SHA of the deployment being rolled back to */
  rollbackToSha: string;
  /** Highest risk level detected in migrations for this rollback */
  riskLevel: MigrationOperationType;
  /** Human-readable descriptions of each SQL operation affected */
  changes: string[];
  status: "pending" | "executing" | "success" | "failed";
  initiatedAt: string;
  completedAt?: string;
  /** The new deployment ID created by Vercel after promotion */
  newDeploymentId?: string;
  error?: string;
}
