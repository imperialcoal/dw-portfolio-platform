// Builds a synthetic CiJobPayload that passes CiJobPayloadSchema validation
// and exercises the full CI agent pipeline:
//   QStash → /api/process/ci → runCiAgent → Redis incident
//
// The githubPayload shape mirrors what the real GitHub webhook sends.
// The CI agent extracts workflow_run from this payload — we provide enough
// structure for normalizeGitHubWorkflowRun() to succeed.
//
// runId is time-based so each trigger produces a unique dedup key.
// The agent fetches job logs from GitHub API using the runId — since this
// is a synthetic run ID, the log fetch will return empty/not-found.
// The agent handles this gracefully and still produces an incident record
// based on the payload context alone.

import type { CiJobPayload } from "@dw/contracts/queue";

export function buildSyntheticCiPayload(): CiJobPayload {
  const runId = `demo-${Date.now()}`;
  const commitSha = `demo${Date.now().toString(16)}`;
  const now = new Date().toISOString();

  return {
    type: "ci.failure",
    runId,
    repoFullName: "imperialcoal/dw-portfolio-platform",
    githubPayload: {
      action: "completed",
      workflow_run: {
        id: runId,
        name: "CI",
        head_branch: "dev",
        head_sha: commitSha,
        status: "completed",
        conclusion: "failure",
        html_url: `https://github.com/imperialcoal/dw-portfolio-platform/actions/runs/${runId}`,
        created_at: now,
        updated_at: now,
        head_commit: {
          id: commitSha,
          message: "feat: demo trigger — synthetic CI failure",
          author: {
            name: "Demo Trigger",
            email: "demo@dw-portfolio.dev",
          },
        },
        repository: {
          full_name: "imperialcoal/dw-portfolio-platform",
        },
        jobs_url: `https://api.github.com/repos/imperialcoal/dw-portfolio-platform/actions/runs/${runId}/jobs`,
      },
      repository: {
        full_name: "imperialcoal/dw-portfolio-platform",
        name: "dw-portfolio-platform",
        owner: {
          login: "imperialcoal",
        },
      },
      sender: {
        login: "demo-trigger",
      },
    },
  };
}
