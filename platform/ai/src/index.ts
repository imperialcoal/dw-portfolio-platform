// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────
export { verifyGitHubSignature, verifySentrySignature } from "./actions/crypto";
export { createIssue, commitFile, postPrComment } from "./actions/github";
export { generateAndCommitIncidentDoc } from "./actions/incident-doc";

// ─────────────────────────────────────────────
// Agents
// Docs agent is nightly/scheduled — not an incident analyzer.
// CI/Sentry/Security agents are incident analyzers triggered by webhooks.
// ─────────────────────────────────────────────
export { runControlLoop, checkAgentHealth } from "./agent/control-loop";
export { runDocsAgent } from "./agent/docs-agent";

export { runCiAgent } from "./analyzers/ci-agent";
export { runSentryAgent } from "./analyzers/sentry-agent";
export { runSecurityAgent } from "./analyzers/security-agent";

// ─────────────────────────────────────────────
// Memory
// ─────────────────────────────────────────────
export {
  isDuplicate,
  logIncident,
  markIncidentOpen,
  updateIncidentStatus,
  getIncident,
  getIncidents,
  findIncidentByGithubIssue,
  findIncidentBySentryIssue,
  findIncidentBySecurityAlert,
  logEvent,
  getEvents,
  getSystemHealth,
} from "./memory/redis";

// ─────────────────────────────────────────────
// Sensors
// ─────────────────────────────────────────────
export { fetchCiJobDetails } from "./sensors/github-ci";
export {
  fetchSentryIssueDetail,
  fetchSentryIssueEvents,
  fetchSentryIssues,
} from "./sensors/sentry";
export {
  fetchRecentDeployments,
  getLastProductionDeploy,
  getLastDeploy,
} from "./sensors/vercel";
export { scanRepo } from "./sensors/repo";
