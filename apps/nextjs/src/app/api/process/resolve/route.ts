import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  findIncidentByGithubIssue,
  findIncidentBySentryIssue,
  updateIncidentStatus,
} from "@dw/ai/memory";
import {
  GithubResolutionPayloadSchema,
  SentryResolutionPayloadSchema,
} from "@dw/contracts/queue";
import { verifyQStashRequest } from "@dw/qstash";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const isValid = await verifyQStashRequest(
    req.headers.get("upstash-signature"),
    rawBody,
  );
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    rawPayload !== null &&
    typeof rawPayload === "object" &&
    "type" in rawPayload
  ) {
    const type = (rawPayload as Record<string, unknown>).type;

    // ── GitHub issue closed → resolved ────────────────────────────────────
    if (type === "github.issue_closed") {
      const result = GithubResolutionPayloadSchema.safeParse(rawPayload);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const { issueNumber } = result.data;
      const incident = await findIncidentByGithubIssue(issueNumber);

      if (!incident) {
        console.log(
          JSON.stringify({
            level: "info",
            processor: "resolve",
            event: "no_matching_incident",
            issueNumber,
          }),
        );
        return NextResponse.json({ ok: true, matched: false });
      }

      await updateIncidentStatus(incident.id, "resolved", {
        resolvedBy: "github_issue_closed",
        resolutionNote: `GitHub issue #${issueNumber} was closed`,
      });

      console.log(
        JSON.stringify({
          level: "info",
          processor: "resolve",
          event: "resolved",
          incidentId: incident.id,
          issueNumber,
          resolvedBy: "github_issue_closed",
        }),
      );

      return NextResponse.json({ ok: true, matched: true, id: incident.id });
    }

    // ── Sentry issue resolved → monitoring ────────────────────────────────
    if (type === "sentry.issue_resolved") {
      const result = SentryResolutionPayloadSchema.safeParse(rawPayload);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const { issueId } = result.data;
      const incident = await findIncidentBySentryIssue(issueId);

      if (!incident) {
        console.log(
          JSON.stringify({
            level: "info",
            processor: "resolve",
            event: "no_matching_incident",
            sentryIssueId: issueId,
          }),
        );
        return NextResponse.json({ ok: true, matched: false });
      }

      // Sentry resolved → monitoring (not fully resolved — may recur)
      await updateIncidentStatus(incident.id, "monitoring", {
        resolvedBy: "sentry_resolved",
        resolutionNote: "Sentry issue resolved — monitoring for recurrence",
      });

      console.log(
        JSON.stringify({
          level: "info",
          processor: "resolve",
          event: "monitoring",
          incidentId: incident.id,
          sentryIssueId: issueId,
        }),
      );

      return NextResponse.json({ ok: true, matched: true, id: incident.id });
    }
  }

  return NextResponse.json(
    { error: "Unknown resolution type" },
    { status: 400 },
  );
}
