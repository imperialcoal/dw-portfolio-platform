"use client";

import { useState } from "react";

export function RunDocsAgentButton({ branch }: { branch: string }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );

  async function run() {
    setStatus("running");
    const res = await fetch("/api/platform/docs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch }),
    });
    setStatus(res.ok ? "done" : "error");
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <button
      onClick={run}
      disabled={status === "running"}
      className="mt-2 text-xs text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-wait"
    >
      {status === "idle" && "↻ Run docs agent"}
      {status === "running" && "Running…"}
      {status === "done" && "✓ Done"}
      {status === "error" && "✗ Failed"}
    </button>
  );
}
