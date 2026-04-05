// ─────────────────────────────────────────────
// Incident status lifecycle
//
// open         → detected, not yet analyzed or actioned
// investigating → agent is actively analyzing
// monitoring   → Sentry resolved but watching for recurrence
// resolved     → confirmed fixed (GitHub issue closed or manual)
// closed       → historical, no further action needed
// ─────────────────────────────────────────────

export type IncidentStatus =
  | "open"
  | "investigating"
  | "monitoring"
  | "resolved"
  | "closed";

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "open",
  "investigating",
  "monitoring",
  "resolved",
  "closed",
];

export interface IncidentDocResult {
  filePath: string;
  slug: string;
}

export interface IncidentRecord {
  // ── Identity ──────────────────────────────────────────────────────────────
  type:
    | "ci_failure"
    | "sentry_error"
    | "security_alert"
    | "clerk_event"
    | "uptime_failure"
    | "supabase_advisory";
  id: string;
  service: string;
  timestamp: string;

  // ── AI analysis ───────────────────────────────────────────────────────────
  summary: string;
  rootCause: string;
  severity: "critical" | "high" | "medium" | "low";
  labels: string[];

  // ── Status lifecycle ──────────────────────────────────────────────────────
  status: IncidentStatus;
  updatedAt: string;

  // ── Resolution ────────────────────────────────────────────────────────────
  resolvedAt?: string;
  resolvedBy?: "github_issue_closed" | "sentry_resolved" | "manual";
  resolutionNote?: string;

  // ── Correlation ───────────────────────────────────────────────────────────
  /** GitHub issue URL created by the agent */
  issueUrl?: string;
  /** GitHub issue number for webhook resolution matching */
  githubIssueNumber?: number;
  /**
   * Sentry issue ID for sentry_error incidents.
   * Dependabot alert number (as string) for security_alert incidents.
   */
  sentryIssueId?: string;
  /** Incident doc path committed to the repo */
  incidentDocPath?: string;
  /** Deployment SHA at time of incident — for correlation */
  commitSha?: string;
  /** Branch where the incident occurred */
  branch?: string;
}

export interface IncidentSummary {
  id: string;
  type: IncidentRecord["type"];
  service: string;
  severity: IncidentRecord["severity"];
  status: IncidentStatus;
  summary: string;
  timestamp: string;
  updatedAt: string;
  issueUrl?: string;
  sentryIssueId?: string;
  githubIssueNumber?: number;
}

export function toIncidentSummary(record: IncidentRecord): IncidentSummary {
  return {
    id: record.id,
    type: record.type,
    service: record.service,
    severity: record.severity,
    status: record.status,
    summary: record.summary,
    timestamp: record.timestamp,
    updatedAt: record.updatedAt,
    issueUrl: record.issueUrl,
    sentryIssueId: record.sentryIssueId,
    githubIssueNumber: record.githubIssueNumber,
  };
}
