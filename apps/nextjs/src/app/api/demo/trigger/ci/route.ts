// Demo-only endpoint — fires a synthetic CI failure through the real pipeline.
// Guarded: requires recruiter or admin role. Returns 404 when DEMO_MODE=false.
//
// Flow: POST here → buildSyntheticCiPayload() → publishCiJob() → QStash
//   → /api/process/ci → runCiAgent() → Redis incident record
//
// Auth uses getRequestAuthority() + canViewPlatform() directly rather than
// requireRecruiterOrAdmin() — redirect() inside a try/catch in a Route Handler
// would be caught before Next.js can process it as a redirect response.
//
// To remove: delete src/app/api/demo/ and src/demo/triggers/.

import { NextResponse } from "next/server";

import { canViewPlatform } from "@dw/auth/roles";
import { publishCiJob } from "@dw/qstash";
import { isQStashConfigured } from "@dw/validators/qstash-env";

import { getRequestAuthority } from "~/auth/request-authority";
import { isDemoMode } from "~/demo";
import { buildSyntheticCiPayload } from "~/demo/triggers/ci-payload";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authority = await getRequestAuthority().catch(() => null);
  if (!authority || !canViewPlatform(authority.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isQStashConfigured()) {
    return NextResponse.json(
      { error: "QStash not configured" },
      { status: 503 },
    );
  }

  try {
    const payload = buildSyntheticCiPayload();
    const messageId = await publishCiJob(payload);
    return NextResponse.json({ ok: true, messageId, type: "ci" });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        demo: "trigger",
        type: "ci",
        error: String(err),
      }),
    );
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }
}
