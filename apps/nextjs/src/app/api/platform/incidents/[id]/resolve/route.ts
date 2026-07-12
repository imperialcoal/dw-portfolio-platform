// Manual resolution endpoint — called from the platform dashboard Resolve button.
// Admin OR recruiter. Recruiters have full mutation parity with admin
// throughout this platform (see packages/auth/src/roles.ts) — this route
// previously used requireAdmin() specifically, which was the one place
// that parity was accidentally broken, blocking recruiters from resolving
// incidents they'd just triggered via the demo panel.
//
// Uses getRequestAuthority() + canViewPlatform() directly (same pattern as
// src/app/api/demo/trigger/ci and .../sentry) rather than importing
// anything from src/demo/ — this keeps this core platform route free of
// any dependency on the demo overlay, so deleting src/demo/ later doesn't
// require touching this file.
//
// Resolves the Redis incident record AND closes the linked GitHub Issue.
//
// GitHub Issue closure is now awaited (not fire-and-forget) so the close
// completes before the function returns. This ensures the Vercel function
// doesn't tear down before the GitHub API call completes, eliminating the
// ~30-60s delay between platform resolve and GitHub issue close.
//
// This is the platform → GitHub direction.
// The inverse (GitHub → platform) is handled by /api/process/resolve via QStash
// when the issues.closed webhook fires.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { closeGithubIssue, getIncident, updateIncidentStatus } from "@dw/ai";
import { canViewPlatform } from "@dw/auth/roles";

import { getRequestAuthority } from "~/auth/request-authority";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authority = await getRequestAuthority().catch(() => null);
  if (!authority || !canViewPlatform(authority.user.role)) {
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

  // 3. Close the linked GitHub Issue if one exists.
  // Awaited synchronously — ensures the GitHub API call completes before the
  // Vercel function returns and potentially tears down. Previously using
  // void/fire-and-forget caused a ~30-60s delay because async execution raced
  // against function teardown after the response was flushed.
  // supabase_advisory incidents have no GitHub issue — this is a no-op for them.
  if (incident.githubIssueNumber) {
    try {
      await closeGithubIssue(incident.githubIssueNumber);
    } catch (err: unknown) {
      // Log but don't fail the response — Redis resolution already succeeded.
      console.error(
        JSON.stringify({
          level: "error",
          route: "incidents/resolve",
          incidentId: id,
          githubIssueNumber: incident.githubIssueNumber,
          error: String(err),
        }),
      );
    }
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
