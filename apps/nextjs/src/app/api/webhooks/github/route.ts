import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifyGitHubSignature } from "@dw/ai/actions";
import { safeId } from "@dw/contracts";
import {
  publishCiJob,
  publishGithubResolution,
  publishSecurityAlert,
} from "@dw/qstash";
import { isQStashConfigured } from "@dw/validators/qstash-env";

import { env } from "~/env";

export const runtime = "edge";

// ─────────────────────────────────────────────
// Environment gate
//
// GitHub webhooks are repo-scoped — they fire for all branches regardless
// of which environment receives them. This gate prevents:
//   - Production CI failures appearing in the preview dashboard
//   - Preview CI failures appearing in the production dashboard
//
// Rules:
//   preview/local/test → process all branches except main
//   production → process main only
//
// Unknown branch (null) is allowed through — the agent will handle it.
// Dependabot branches (dependabot/*) are treated as non-main.
// ─────────────────────────────────────────────

function isBranchAllowedInCurrentEnv(branch: string | null): boolean {
  if (branch === null) return true;
  const isMain = branch === "main";
  return env.NEXT_PUBLIC_APP_ENV === "production" ? isMain : !isMain;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const isValid = await verifyGitHubSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = req.headers.get("x-github-event");

  // ── workflow_run: CI failure → enqueue CI agent ───────────────────────────
  if (event === "workflow_run") {
    const workflowRun =
      payload.workflow_run !== null && typeof payload.workflow_run === "object"
        ? (payload.workflow_run as Record<string, unknown>)
        : null;
    const action = typeof payload.action === "string" ? payload.action : null;

    if (action !== "completed" || workflowRun?.conclusion !== "failure") {
      return NextResponse.json({ ok: true, skipped: "not_a_failure" });
    }

    // Agent commit filter — breaks the incident doc commit → CI run → incident loop.
    // The agent tags all its commits with [platform-agent] in the message.
    // QStash dedup (commit SHA key) provides a second layer of protection.
    const headCommit =
      workflowRun.head_commit !== null &&
      typeof workflowRun.head_commit === "object"
        ? (workflowRun.head_commit as Record<string, unknown>)
        : null;
    const commitMessage =
      typeof headCommit?.message === "string" ? headCommit.message : "";

    if (commitMessage.includes("[platform-agent]")) {
      console.log(
        JSON.stringify({
          level: "info",
          webhook: "github",
          event: "agent_commit_skip",
          commitMessage: commitMessage.slice(0, 100),
        }),
      );
      return NextResponse.json({ ok: true, skipped: "agent_commit" });
    }

    // Environment gate
    const branch =
      typeof workflowRun.head_branch === "string"
        ? workflowRun.head_branch
        : null;

    if (!isBranchAllowedInCurrentEnv(branch)) {
      console.log(
        JSON.stringify({
          level: "info",
          webhook: "github",
          event: "env_gate_skip",
          branch,
          appEnv: env.NEXT_PUBLIC_APP_ENV,
        }),
      );
      return NextResponse.json({
        ok: true,
        skipped: "env_gate",
        branch,
        appEnv: env.NEXT_PUBLIC_APP_ENV,
      });
    }

    if (!isQStashConfigured()) {
      return NextResponse.json({ ok: true, skipped: "qstash_not_configured" });
    }

    const repository =
      payload.repository !== null && typeof payload.repository === "object"
        ? (payload.repository as Record<string, unknown>)
        : {};

    const runId = safeId(workflowRun.id);
    const repoFullName =
      typeof repository.full_name === "string"
        ? repository.full_name
        : "unknown";

    const messageId = await publishCiJob({
      type: "ci.failure",
      runId,
      repoFullName,
      githubPayload: payload,
    });

    return NextResponse.json({ ok: true, queued: true, messageId });
  }

  // ── issues.closed: incident resolution → enqueue processor ───────────────
  if (event === "issues") {
    const action = typeof payload.action === "string" ? payload.action : null;

    if (action !== "closed") {
      return NextResponse.json({ ok: true, ignored: `issues.${action}` });
    }

    const issue =
      payload.issue !== null && typeof payload.issue === "object"
        ? (payload.issue as Record<string, unknown>)
        : {};

    const issueNumber = typeof issue.number === "number" ? issue.number : null;
    if (issueNumber === null) {
      return NextResponse.json({ ok: true, skipped: "no_issue_number" });
    }

    const labels = Array.isArray(issue.labels)
      ? (issue.labels as Record<string, unknown>[])
      : [];
    const isPlatformAgentIssue = labels.some(
      (l) => typeof l.name === "string" && l.name === "platform-agent",
    );
    if (!isPlatformAgentIssue) {
      return NextResponse.json({
        ok: true,
        ignored: "not_platform_agent_issue",
      });
    }

    if (!isQStashConfigured()) {
      return NextResponse.json({ ok: true, skipped: "qstash_not_configured" });
    }

    const messageId = await publishGithubResolution({
      type: "github.issue_closed",
      issueNumber,
      issueUrl: typeof issue.html_url === "string" ? issue.html_url : "",
    });

    return NextResponse.json({ ok: true, queued: true, messageId });
  }

  // ── repository_vulnerability_alert: Dependabot → enqueue security agent ──
  if (event === "repository_vulnerability_alert") {
    const action = typeof payload.action === "string" ? payload.action : "";

    const alert =
      payload.alert !== null && typeof payload.alert === "object"
        ? (payload.alert as Record<string, unknown>)
        : {};

    const alertId = safeId(alert.number ?? alert.id);

    if (!isQStashConfigured()) {
      return NextResponse.json({ ok: true, skipped: "qstash_not_configured" });
    }

    const messageId = await publishSecurityAlert({
      type: "security.alert",
      alertId,
      action,
      githubPayload: payload,
    });

    console.log(
      JSON.stringify({
        level: "info",
        webhook: "github",
        event: "security_alert_queued",
        alertId,
        action,
        messageId,
      }),
    );

    return NextResponse.json({ ok: true, queued: true, messageId });
  }

  return NextResponse.json({ ok: true, ignored: event });
}
