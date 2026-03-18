import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import type { IncidentStatus } from "@dw/contracts";
import { getIncident, updateIncidentStatus } from "@dw/ai/memory";
import { INCIDENT_STATUSES } from "@dw/contracts";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";

const ResolveBody = z.object({
  status: z.enum(INCIDENT_STATUSES as unknown as [string, ...string[]]),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Admin-only — uses Clerk auth
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ResolveBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const incident = await getIncident(id);
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const updated = await updateIncidentStatus(
    id,
    parsed.data.status as IncidentStatus,
    {
      resolvedBy: "manual",
      resolutionNote: parsed.data.note,
    },
  );

  return NextResponse.json({ ok: true, incident: updated });
}
