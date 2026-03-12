export interface ControlLoopResult {
  ranAt: string;
  sentryIssuesScanned: number;
  incidentsInMemory: number;
  lastDeployCommit: string | null;
  errors: string[];
}
