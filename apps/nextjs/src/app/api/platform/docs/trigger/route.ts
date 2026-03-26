import { NextResponse } from "next/server";

import { runDocsAgent } from "@dw/ai/agent";

import { requireAdmin } from "~/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { branch = "dev" } = (await req.json().catch(() => ({}))) as {
    branch?: string;
  };
  try {
    const result = await runDocsAgent(branch);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
