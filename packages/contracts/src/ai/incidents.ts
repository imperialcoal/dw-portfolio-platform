export interface IncidentDocResult {
  filePath: string;
  slug: string;
}

// Stored in Redis platform:incidents list for dashboard consumption
export interface IncidentRecord {
  type: "ci_failure" | "sentry_error";
  id: string;
  summary: string;
  rootCause: string;
  severity: "critical" | "high" | "medium" | "low";
  labels: string[];
  service: string;
  timestamp: string;
  issueUrl?: string;
  incidentDocPath?: string;
}
