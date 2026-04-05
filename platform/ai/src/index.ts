// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────
export { verifyGitHubSignature, verifySentrySignature } from "./actions/crypto";
export {
  commitFile,
  appendToFile,
  createIssue,
  postPrComment,
} from "./actions/github";
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
export { runDepsAgent } from "./analyzers/deps-agent";

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
  getDepAnalysis,
  storeDepAnalysis,
  createRollbackRecord,
  updateRollbackRecord,
  getRollbackRecord,
} from "./memory/redis";

export {
  logUserActivity,
  getUserActivity,
  incrementFailedSessions,
  getFailedSessionCount,
  clearFailedSessions,
} from "./memory/user-activity";

export { getMaintenanceMode, setMaintenanceMode } from "./memory/maintenance";

export {
  recordPerfSample,
  getPerfBaseline,
  setPerfBaseline,
  getRollingPerf,
  computePercentile,
} from "./memory/performance";

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
  fetchLiveDeploymentId,
  getLastProductionDeploy,
  getLastDeploy,
} from "./sensors/vercel";

export { scanRepo } from "./sensors/repo";

export { analyzeDeploymentMigrations } from "./sensors/migrations";

export {
  fetchDependabotPRs,
  fetchSecurityAlerts,
  mergeDependabotPR,
} from "./sensors/github-deps";

export {
  fetchDbHealth,
  fetchSupabaseAdvisories,
  runUptimeChecks,
  isSupabaseConfigured,
} from "./sensors/supabase";
