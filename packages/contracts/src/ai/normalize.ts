import type {
  CiFailureEvent,
  SecurityAlertEvent,
  SentryErrorEvent,
} from "./events";

const MAX_LOG_CHARS = 8_000;

// ─────────────────────────────────────────────
// Type-narrowing helpers
// ─────────────────────────────────────────────

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" ? v : Number(v ?? fallback);
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function safeId(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "";
}

// ─────────────────────────────────────────────
// GitHub workflow_run → CiFailureEvent
// ─────────────────────────────────────────────

export function normalizeGitHubWorkflowRun(
  payload: Record<string, unknown>,
  jobLogs: string,
): CiFailureEvent {
  const run = obj(payload.workflow_run);
  const pullRequests = Array.isArray(run.pull_requests)
    ? run.pull_requests
    : [];
  const pr = pullRequests.length > 0 ? obj(pullRequests[0]) : null;
  const actor = obj(run.triggering_actor);
  const repo = obj(payload.repository);
  const headSha = str(run.head_sha, "");

  return {
    type: "ci_failure",
    id: safeId(run.id),
    timestamp: str(run.updated_at, new Date().toISOString()),
    service: str(repo.name, "unknown"),
    context: {
      workflow: str(run.name ?? run.workflow_id, "unknown"),
      branch: str(run.head_branch, "unknown"),
      commitSha: headSha.slice(0, 7),
      prNumber: pr !== null ? num(pr.number, 0) : null,
      prTitle: pr !== null ? str(pr.title, "") : null,
      jobLogs: truncate(jobLogs, MAX_LOG_CHARS),
      failedStep: extractFailedStep(jobLogs),
      triggeredBy: str(actor.login, "unknown"),
    },
  };
}

// ─────────────────────────────────────────────
// Sentry webhook → SentryErrorEvent
// ─────────────────────────────────────────────

export function normalizeSentryWebhook(
  payload: Record<string, unknown>,
): SentryErrorEvent {
  const data = obj(payload.data);
  const issue = obj(data.issue ?? payload.issue);
  const event = obj(data.event);
  const request = obj(event.request);
  const project = obj(issue.project);

  return {
    type: "sentry_error",
    id: safeId(issue.id),
    timestamp: str(issue.firstSeen, new Date().toISOString()),
    service: str(payload.project_slug ?? project.slug, "unknown"),
    context: {
      title: str(issue.title, "Unknown error"),
      culprit: str(issue.culprit ?? event.culprit, "unknown"),
      stacktrace: truncate(extractSentryStacktrace(event), MAX_LOG_CHARS),
      route: str(request.url ?? event.transaction, "") || null,
      environment: str(event.environment ?? issue.environment, "unknown"),
      userCount: num(issue.userCount, 0),
      firstSeen: str(issue.firstSeen, new Date().toISOString()),
      issueUrl: str(issue.permalink, ""),
    },
  };
}

// ─────────────────────────────────────────────
// GitHub repository_vulnerability_alert → SecurityAlertEvent
// ─────────────────────────────────────────────

export function normalizeSecurityAlert(
  payload: Record<string, unknown>,
): SecurityAlertEvent {
  const alert = obj(payload.alert);
  const repo = obj(payload.repository);
  const secAdvisory = obj(alert.security_advisory);
  const secVuln = obj(alert.security_vulnerability);
  const pkg = obj(secVuln.package);
  const dependency = obj(alert.dependency);

  const firstPatchedVersion =
    secVuln.first_patched_version !== null &&
    typeof secVuln.first_patched_version === "object"
      ? str(obj(secVuln.first_patched_version).identifier, "")
      : null;

  const severityRaw = str(secAdvisory.severity, "medium").toLowerCase();
  const ghSeverity = (["low", "medium", "high", "critical"] as const).includes(
    severityRaw as "low" | "medium" | "high" | "critical",
  )
    ? (severityRaw as SecurityAlertEvent["context"]["ghSeverity"])
    : "medium";

  const scopeRaw = str(alert.dependency_scope, "");
  const scope =
    scopeRaw === "runtime" || scopeRaw === "development" ? scopeRaw : null;

  return {
    type: "security_alert",
    id: safeId(alert.number ?? alert.id),
    timestamp: new Date().toISOString(),
    service: str(repo.full_name, "unknown"),
    context: {
      alertNumber: num(alert.number, 0),
      packageName: str(pkg.name, "unknown"),
      ecosystem: str(pkg.ecosystem, "unknown"),
      vulnerableVersionRange: str(secVuln.vulnerable_version_range, "unknown"),
      firstPatchedVersion: firstPatchedVersion ?? null,
      ghSeverity,
      cveId: str(secAdvisory.cve_id, "") || null,
      ghsaId: str(secAdvisory.ghsa_id, ""),
      summary: str(secAdvisory.summary, ""),
      alertUrl: str(alert.html_url, ""),
      manifestPath: str(dependency.manifest_path, ""),
      scope,
    },
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return (
    text.slice(0, half) +
    `\n\n... [${text.length - max} chars truncated] ...\n\n` +
    text.slice(-half)
  );
}

function extractFailedStep(logs: string): string {
  const patterns = [
    /^##\[error\](.+)$/m,
    /^Error: (.+)$/m,
    /FAILED (.+)$/m,
    /✗ (.+)$/m,
  ];
  for (const pattern of patterns) {
    const match = logs.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 200);
  }
  return "Unknown step";
}

interface SentryFrame {
  in_app?: boolean;
  filename?: string;
  function?: string;
  lineno?: number;
}

interface SentryException {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: SentryFrame[];
  };
}

function extractSentryStacktrace(event: Record<string, unknown>): string {
  try {
    const exception = obj(event.exception);
    const values = Array.isArray(exception.values) ? exception.values : [];
    const first: SentryException =
      values[0] !== undefined ? (values[0] as SentryException) : {};

    if (first.type === undefined && first.value === undefined) {
      return "No stacktrace available";
    }

    const frames: SentryFrame[] = first.stacktrace?.frames ?? [];
    const relevant = frames
      .filter(
        (f) =>
          f.in_app === true ||
          f.filename?.includes("apps/") === true ||
          f.filename?.includes("packages/") === true,
      )
      .slice(-10);

    const lines = relevant
      .map(
        (f) =>
          `  at ${f.function ?? "?"} (${f.filename ?? "?"}:${f.lineno ?? "?"})`,
      )
      .join("\n");

    return `${first.type ?? "Error"}: ${first.value ?? "unknown"}\n${lines}`;
  } catch {
    return "Could not parse stacktrace";
  }
}
