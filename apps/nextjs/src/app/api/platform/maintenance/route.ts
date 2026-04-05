// GET  → returns current maintenance mode status
// POST → enable/disable maintenance mode (admin only)
//
// The Next.js middleware (proxy.ts) reads the maintenance key from Redis
// and shows a maintenance page to non-admin users when enabled.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getMaintenanceMode, setMaintenanceMode } from "@dw/ai/memory";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mode = await getMaintenanceMode();
  return NextResponse.json({ maintenance: mode });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { enabled, message, enabledBy } = body as {
    enabled?: boolean;
    message?: string;
    enabledBy?: string;
  };

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be boolean" },
      { status: 400 },
    );
  }

  await setMaintenanceMode({
    enabled,
    message: message ?? "We're performing scheduled maintenance. Back shortly.",
    enabledAt: new Date().toISOString(),
    enabledBy: enabledBy ?? "admin",
  });

  console.log(
    JSON.stringify({
      level: "info",
      route: "maintenance",
      event: enabled ? "maintenance_enabled" : "maintenance_disabled",
      enabledBy,
    }),
  );

  return NextResponse.json({ ok: true, enabled });
}
