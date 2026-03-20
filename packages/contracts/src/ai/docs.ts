export interface DocsAgentResult {
  ranAt: string;
  branch: string;
  filesUpdated: string[];
  filesSkipped: string[];
  errors: string[];
  durationMs: number;
}
