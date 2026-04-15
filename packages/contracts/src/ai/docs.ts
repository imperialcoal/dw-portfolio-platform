import type { RepoStructure } from "./repo";

export interface DocsAgentResult {
  ranAt: string;
  branch: string;
  filesUpdated: string[];
  filesSkipped: string[];
  errors: string[];
  durationMs: number;
}

// ─────────────────────────────────────────────
// Structural diff types
// ─────────────────────────────────────────────

export interface DriftItem {
  category:
    | "new_api_route"
    | "new_package"
    | "new_env_var"
    | "new_cron"
    | "new_webhook_handler"
    | "missing_readme"
    | "empty_readme";
  path: string;
  description: string;
  affectedDocs: string[];
}

// ─────────────────────────────────────────────
// Claude changelog generation
// ─────────────────────────────────────────────

export interface DocChangelogSpec {
  docPath: string;
  systemPrompt: string;
  buildPrompt: (
    items: { description: string; path: string }[],
    existingDoc: string,
    repo: RepoStructure,
  ) => string;
}
