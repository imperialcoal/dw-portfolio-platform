// Sensors only gather raw signals — no analysis logic here.

interface GitHubJob {
  name: string;
  conclusion: string | null;
  steps?: { name: string; conclusion: string | null; number: number }[];
}

/**
 * Fetches the failed job steps from a GitHub workflow run.
 * GitHub's log download requires a redirect + zip extraction — fetching
 * the jobs endpoint gives us structured step-level failure info instead.
 */
export async function fetchCiJobDetails(
  repo: string,
  runId: string,
): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return "[GITHUB_TOKEN not set — cannot fetch job details]";

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!res.ok) return `[Could not fetch CI jobs: HTTP ${res.status}]`;

  const data = (await res.json()) as { jobs: GitHubJob[] };
  const failedJobs = data.jobs.filter((j) => j.conclusion === "failure");

  if (failedJobs.length === 0) return "[No failed jobs found in run]";

  return failedJobs
    .map((job) => {
      const failedSteps = (job.steps ?? [])
        .filter((s) => s.conclusion === "failure")
        .map((s) => `  Step ${s.number}: ${s.name} — FAILED`);
      return `Job: ${job.name}\n${failedSteps.length > 0 ? failedSteps.join("\n") : "  (no step-level detail)"}`;
    })
    .join("\n\n");
}
