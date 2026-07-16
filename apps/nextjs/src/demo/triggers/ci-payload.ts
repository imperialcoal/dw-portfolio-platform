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
//
// head_sha uses crypto.randomUUID() rather than Date.now().toString(16) —
// buildCiDedupId() in @dw/qstash truncates commitSha to its first 7
// characters (correct for a real git short-SHA, which is high-entropy
// throughout). A hex-encoded timestamp is NOT high-entropy in its leading
// characters — those only change roughly once every two years at current
// epoch-ms magnitudes — so truncating one collapsed to a near-constant
// dedup key across every demo trigger for days at a time, silently
// colliding with QStash's own deduplication window. A random UUID is
// high-entropy in every character position, matching what the truncation
// logic actually expects.

import type { CiJobPayload } from "@dw/contracts/queue";

export function buildSyntheticCiPayload(): CiJobPayload {
  const runId = `demo-${Date.now()}`;
  const commitSha = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const now = new Date().toISOString();

  return {
    type: "ci.failure",
    runId,
    repoFullName: "imperialcoal/dw-portfolio-platform",
    isDemo: true,
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
        // normalizeGitHubWorkflowRun() reads run.triggering_actor.login
        // into context.triggeredBy — NOT the sender field below (that's
        // real GitHub webhook shape but isn't what gets extracted). Without
        // this, "Triggered by" silently fell back to "unknown" in every
        // analysis prompt, discarding the one human-readable breadcrumb
        // this payload was already trying to provide.
        triggering_actor: {
          login: "demo-trigger",
        },
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
