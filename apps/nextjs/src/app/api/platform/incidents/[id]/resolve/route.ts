// apps/nextjs/src/app/api/platform/incidents/[id]/resolve/route.ts
//
// Manual resolution endpoint — called from the platform dashboard Resolve button.
// Admin-only. Resolves the Redis incident record AND closes the linked GitHub Issue.
//
// The GitHub Issue closure is fire-and-forget — if it fails (e.g. the issue was
// already closed or GITHUB_TOKEN lacks write access), the Redis resolution still
// completes and the response is still 200. The error is logged for observability.
//
// This is the platform → GitHub direction.
// The inverse (GitHub → platform) is handled by /api/process/resolve via QStash
// when the issues.closed webhook fires.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Import from the root package — subpath "@dw/ai/actions" doesn't resolve
// correctly in the Next.js TypeScript context, causing no-unsafe-call errors.
// The root index re-exports all actions including closeGithubIssue.
import { closeGithubIssue, getIncident, updateIncidentStatus } from "@dw/ai";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing incident ID" }, { status: 400 });
  }

  // 1. Fetch the current incident to get the GitHub issue number before resolving
  const incident = await getIncident(id);

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  if (incident.status === "resolved" || incident.status === "closed") {
    return NextResponse.json(
      { error: "Incident is already resolved" },
      { status: 409 },
    );
  }

  // 2. Resolve in Redis
  const updated = await updateIncidentStatus(id, "resolved", {
    resolvedBy: "manual",
    resolutionNote: "Manually resolved via platform dashboard",
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Failed to update incident status" },
      { status: 500 },
    );
  }

  // 3. Close the linked GitHub Issue if one exists
  // Fire-and-forget — Redis resolution takes priority.
  // supabase_advisory incidents don't have GitHub issues, so this only
  // runs for ci_failure, sentry_error, and security_alert incidents.
  if (incident.githubIssueNumber) {
    void closeGithubIssue(incident.githubIssueNumber).catch((err: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          route: "incidents/resolve",
          incidentId: id,
          githubIssueNumber: incident.githubIssueNumber,
          error: String(err),
        }),
      );
    });
  }

  console.log(
    JSON.stringify({
      level: "info",
      route: "incidents/resolve",
      incidentId: id,
      type: incident.type,
      githubIssueNumber: incident.githubIssueNumber ?? null,
      githubClosureAttempted: !!incident.githubIssueNumber,
    }),
  );

  return NextResponse.json({
    ok: true,
    id,
    status: "resolved",
    githubIssueNumber: incident.githubIssueNumber ?? null,
  });
}
