// import type { NextRequest } from "next/server";
// import { NextResponse } from "next/server";
// import { waitUntil } from "@vercel/functions";

// import { verifyGitHubSignature } from "@dw/ai/actions";
// import { runCiAgent } from "@dw/ai/analyzers";

// export const runtime = "nodejs";
// export const maxDuration = 300;

// export async function POST(req: NextRequest): Promise<NextResponse> {
//   const rawBody = await req.text();

//   const isValid = verifyGitHubSignature(
//     rawBody,
//     req.headers.get("x-hub-signature-256"),
//   );
//   if (!isValid) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   let payload: Record<string, unknown>;
//   try {
//     payload = JSON.parse(rawBody) as Record<string, unknown>;
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   const event = req.headers.get("x-github-event");

//   if (event === "workflow_run") {
//     const workflowRun =
//       payload.workflow_run !== null && typeof payload.workflow_run === "object"
//         ? (payload.workflow_run as { conclusion?: string })
//         : null;
//     const action = typeof payload.action === "string" ? payload.action : null;

//     if (action !== "completed" || workflowRun?.conclusion !== "failure") {
//       return NextResponse.json({ ok: true, skipped: "not a failure" });
//     }

//     // waitUntil keeps the function alive until the agent completes,
//     // while still returning 200 to GitHub immediately.
//     waitUntil(
//       runCiAgent(payload).catch((err: unknown) =>
//         console.error(
//           JSON.stringify({
//             level: "error",
//             webhook: "github",
//             error: String(err),
//           }),
//         ),
//       ),
//     );

//     return NextResponse.json({ ok: true, queued: true });
//   }

//   return NextResponse.json({ ok: true, ignored: event });
// }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

import { verifyGitHubSignature } from "@dw/ai/actions";
import { runCiAgent } from "@dw/ai/analyzers";

// Edge runtime is required for waitUntil to work correctly on Vercel.
// On Node.js runtime, the process terminates after the response is sent
// regardless of waitUntil. Edge runtime keeps the function alive until
// all waitUntil promises resolve.
export const runtime = "edge";

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

  if (event === "workflow_run") {
    const workflowRun =
      payload.workflow_run !== null && typeof payload.workflow_run === "object"
        ? (payload.workflow_run as { conclusion?: string })
        : null;
    const action = typeof payload.action === "string" ? payload.action : null;

    if (action !== "completed" || workflowRun?.conclusion !== "failure") {
      return NextResponse.json({ ok: true, skipped: "not a failure" });
    }

    waitUntil(
      runCiAgent(payload).catch((err: unknown) =>
        console.error(
          JSON.stringify({
            level: "error",
            webhook: "github",
            error: String(err),
          }),
        ),
      ),
    );

    return NextResponse.json({ ok: true, queued: true });
  }

  return NextResponse.json({ ok: true, ignored: event });
}
