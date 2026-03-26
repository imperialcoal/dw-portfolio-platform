// ─────────────────────────────────────────────
// Dependency management types
// Covers Dependabot PRs and security alert correlation
// ─────────────────────────────────────────────

export type DependencyUpdateType = "major" | "minor" | "patch" | "unknown";
export type DependencyEcosystem =
  | "npm"
  | "pip"
  | "cargo"
  | "maven"
  | "nuget"
  | "unknown";

export interface DependabotPR {
  number: number;
  title: string;
  url: string;
  /** e.g. "react", "@types/node" */
  packageName: string;
  ecosystem: DependencyEcosystem;
  /** e.g. "17.0.2" */
  fromVersion: string | null;
  /** e.g. "18.0.0" */
  toVersion: string | null;
  updateType: DependencyUpdateType;
  /** true if this is a major version change */
  isMajor: boolean;
  /** GitHub label names on the PR */
  labels: string[];
  /** ISO timestamp */
  createdAt: string;
  /** true if breaking change analysis has been run */
  hasAnalysis: boolean;
}

export interface BreakingChangeAnalysis {
  prNumber: number;
  packageName: string;
  fromVersion: string;
  toVersion: string;
  /** Claude's assessment */
  isBreaking: boolean;
  /** One-sentence summary */
  summary: string;
  /** Key breaking changes, if any */
  breakingChanges: string[];
  /** Parts of our codebase that may be affected */
  affectedAreas: string[];
  /** Recommended migration steps */
  migrationSteps: string[];
  /** Overall recommendation */
  recommendation: "merge-safely" | "review-required" | "block-merge";
  /** ISO timestamp of analysis */
  analyzedAt: string;
}

export interface SecurityAlertWithPR {
  /** Dependabot alert number */
  alertId: string;
  packageName: string;
  ecosystem: string;
  severity: "low" | "medium" | "high" | "critical";
  /** CVE or GHSA identifier */
  identifier: string;
  summary: string;
  /** Vulnerable version range */
  vulnerableRange: string;
  /** Fixed version, if available */
  fixedVersion: string | null;
  /** Corresponding Dependabot PR, if one exists */
  fixPR: DependabotPR | null;
  /** True if no fix is available yet */
  noFixAvailable: boolean;
  alertUrl: string;
  /** Our incident ID for this alert, if one was created */
  incidentId: string | null;
}

export interface DependencyDashboardData {
  prs: DependabotPR[];
  securityAlerts: SecurityAlertWithPR[];
  analyses: Record<number, BreakingChangeAnalysis>;
  /** ISO timestamp of last refresh */
  fetchedAt: string;
}

export interface MergeResult {
  prNumber: number;
  success: boolean;
  mergeCommitSha?: string;
  error?: string;
}
