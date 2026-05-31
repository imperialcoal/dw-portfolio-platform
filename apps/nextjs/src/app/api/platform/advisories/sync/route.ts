// Fetches current Supabase security advisories and performs a TRUE bidirectional sync:
//
//   1. CREATE: any advisory not yet in Redis → creates a new supabase_advisory incident
//   2. RESOLVE: any tracked advisory incident whose advisory no longer exists → resolves it
//
// This means clicking "Sync to incidents" always reflects the current state of
// Supabase — advisories that have been fixed are automatically resolved in Redis,
// clearing them from the active incidents list and the Database Health advisory count.
//
// Auth: requireAdmin() — admin session cookie.
// Idempotent: re-running produces no duplicate incidents.

import { NextResponse } from "next/server";

import type { SupabaseAdvisory } from "@dw/contracts";
import {
  getIncidents,
  logIncident,
  markIncidentOpen,
  updateIncidentStatus,
} from "@dw/ai/memory";
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

  // Load all existing advisory incidents from Redis
  const existing = await getIncidents(100).catch(() => []);
  const existingAdvisories = existing.filter(
    (i) => i.type === "supabase_advisory",
  );

  // Stable incident IDs derived from the current Supabase advisory names
  const currentAdvisoryIds = new Set(
    advisories.map(
      (a) =>
        `supabase-advisory-${a.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
    ),
  );

  const existingAdvisoryIds = new Set(existingAdvisories.map((i) => i.id));

  let synced = 0;
  let resolved = 0;

  // ── 1. CREATE: new advisories not yet in Redis ─────────────────────────────
  for (const advisory of advisories) {
    const incidentId = `supabase-advisory-${advisory.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

    if (existingAdvisoryIds.has(incidentId)) {
      // Already tracked — check if it was previously resolved and re-open it
      const existingRecord = existingAdvisories.find(
        (i) => i.id === incidentId,
      );
      if (
        existingRecord &&
        (existingRecord.status === "resolved" ||
          existingRecord.status === "closed")
      ) {
        await updateIncidentStatus(incidentId, "open");
        synced++;
        console.log(
          JSON.stringify({
            level: "info",
            route: "advisories/sync",
            event: "advisory_reopened",
            incidentId,
          }),
        );
      }
      continue;
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

  // ── 2. RESOLVE: advisory incidents in Redis no longer detected in Supabase ──
  //
  // Only resolve open/investigating/monitoring incidents — already-resolved
  // incidents are left alone to preserve history.
  for (const existingAdvisory of existingAdvisories) {
    if (currentAdvisoryIds.has(existingAdvisory.id)) continue;

    if (
      existingAdvisory.status === "open" ||
      existingAdvisory.status === "investigating" ||
      existingAdvisory.status === "monitoring"
    ) {
      await updateIncidentStatus(existingAdvisory.id, "resolved", {
        resolvedBy: "manual",
        resolutionNote:
          "Advisory no longer detected in Supabase Security Advisor",
      });
      resolved++;

      console.log(
        JSON.stringify({
          level: "info",
          route: "advisories/sync",
          event: "advisory_resolved",
          incidentId: existingAdvisory.id,
          reason: "no_longer_detected",
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      route: "advisories/sync",
      event: "complete",
      currentAdvisories: advisories.length,
      created: synced,
      resolved,
    }),
  );

  return NextResponse.json({
    ok: true,
    synced,
    resolved,
    total: advisories.length,
    skipped: advisories.length - synced,
  });
}
