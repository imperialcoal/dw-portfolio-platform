// Fetches Supabase security advisories and creates supabase_advisory incidents
// for any findings not already tracked in Redis.
//
// Called by:
//   - A button on /platform/database (manual trigger)
//   - Optionally: a cron job (add to vercel.json if desired)
//
// Auth: requireAdmin() — admin session cookie, same as all /api/platform/* routes.
// Idempotent: uses the advisory name as a stable dedup ID so re-runs are safe.

import { NextResponse } from "next/server";

import type { SupabaseAdvisory } from "@dw/contracts";
import { getIncidents, logIncident, markIncidentOpen } from "@dw/ai/memory";
import { fetchSupabaseAdvisories } from "@dw/ai/sensors";

import { requireAdmin } from "~/auth/require-admin";
import { env } from "~/env";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let advisories: SupabaseAdvisory[];
  try {
    advisories = await fetchSupabaseAdvisories();
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "advisories/sync",
        event: "fetch_failed",
        error: String(err),
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        synced: 0,
        error:
          err instanceof Error ? err.message : "Failed to fetch advisories",
      },
      { status: 502 },
    );
  }

  if (advisories.length === 0) {
    return NextResponse.json({
      ok: true,
      synced: 0,
      message: "No advisories found",
    });
  }

  // Load existing incidents to avoid duplicating advisories already tracked
  const existing = await getIncidents(100).catch(() => []);
  const existingAdvisoryIds = new Set(
    existing.filter((i) => i.type === "supabase_advisory").map((i) => i.id),
  );

  let synced = 0;

  for (const advisory of advisories) {
    // Stable ID based on advisory name — same advisory won't create duplicate incidents
    const incidentId = `supabase-advisory-${advisory.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

    if (existingAdvisoryIds.has(incidentId)) {
      continue; // Already tracked
    }

    const supabaseRef = env.SUPABASE_PROJECT_REF ?? "";
    const preset =
      advisory.level === "ERROR"
        ? "ERROR"
        : advisory.level === "WARN"
          ? "WARN"
          : "INFO";
    const supabaseUrl = supabaseRef
      ? `https://supabase.com/dashboard/project/${supabaseRef}/advisors/security?preset=${preset}&id=${advisory.name}`
      : undefined;

    const severity =
      advisory.level === "ERROR"
        ? ("high" as const)
        : advisory.level === "WARN"
          ? ("medium" as const)
          : ("low" as const);

    await logIncident({
      type: "supabase_advisory",
      id: incidentId,
      service: "supabase",
      timestamp: advisory.detectedAt,
      summary: advisory.title,
      rootCause: advisory.description,
      severity,
      labels: [
        "database",
        "security",
        "supabase",
        advisory.level.toLowerCase(),
      ],
      issueUrl: supabaseUrl,
      commitSha: undefined,
      branch: undefined,
    });

    await markIncidentOpen(incidentId);
    synced++;
  }

  console.log(
    JSON.stringify({
      level: "info",
      route: "advisories/sync",
      event: "complete",
      total: advisories.length,
      synced,
    }),
  );

  return NextResponse.json({
    ok: true,
    synced,
    total: advisories.length,
    skipped: advisories.length - synced,
  });
}
