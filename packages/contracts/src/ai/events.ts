// All raw webhook payloads are normalized to PlatformEvent before the LLM.
// One analyzer handles all event types.

export interface CiFailureEvent {
  type: "ci_failure";
  /** workflow_run_id — used as dedup key */
  id: string;
  timestamp: string;
  service: string;
  context: {
    workflow: string;
    branch: string;
    commitSha: string;
    prNumber: number | null;
    prTitle: string | null;
    /** Truncated to ~8000 chars */
    jobLogs: string;
    failedStep: string;
    triggeredBy: string;
  };
}

export interface SentryErrorEvent {
  type: "sentry_error";
  /** Sentry issue ID — used as dedup key */
  id: string;
  timestamp: string;
  service: string;
  context: {
    title: string;
    culprit: string;
    stacktrace: string;
    route: string | null;
    environment: string;
    userCount: number;
    firstSeen: string;
    issueUrl: string;
  };
}

export interface SecurityAlertEvent {
  type: "security_alert";
  /** Dependabot alert number — used as dedup key */
  id: string;
  timestamp: string;
  service: string; // repo full name
  context: {
    alertNumber: number;
    packageName: string;
    ecosystem: string;
    vulnerableVersionRange: string;
    firstPatchedVersion: string | null;
    /** Severity from GitHub's CVSS assessment */
    ghSeverity: "low" | "medium" | "high" | "critical";
    cveId: string | null;
    ghsaId: string;
    summary: string;
    alertUrl: string;
    manifestPath: string;
    scope: "runtime" | "development" | null;
  };
}

export type PlatformEvent =
  | CiFailureEvent
  | SentryErrorEvent
  | SecurityAlertEvent;

export interface VercelDeployment {
  id: string;
  url: string;
  state: string;
  createdAt: number;
  target: "production" | "preview" | null;
  meta: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    githubBranch?: string;
  };
}
