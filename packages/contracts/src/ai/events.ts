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

export type PlatformEvent = CiFailureEvent | SentryErrorEvent;

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
