"use client";

// One-click trigger to pull Supabase security advisories into the incident pipeline.
// Works because the browser already carries the Clerk session cookie — no bypass
// token needed when calling from the dashboard UI.
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  ok: boolean;
  synced: number;
  total: number;
  skipped: number;
  message?: string;
}

export function SyncAdvisoriesButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [result, setResult] = useState<SyncResult | null>(null);
  const router = useRouter();

  async function sync() {
    setStatus("running");
    setResult(null);

    try {
      const res = await fetch("/api/platform/advisories/sync", {
        method: "POST",
      });

      if (res.ok) {
        const data = (await res.json()) as SyncResult;
        setResult(data);
        setStatus("done");
        // Refresh the page so new incidents appear in the header banner
        if (data.synced > 0) {
          router.refresh();
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }

    setTimeout(() => {
      setStatus("idle");
      setResult(null);
    }, 6000);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sync}
        disabled={status === "running"}
        className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 disabled:cursor-wait disabled:opacity-50"
      >
        {status === "idle" && "↻ Sync to incidents"}
        {status === "running" && "Syncing…"}
        {status === "done" &&
          result !== null &&
          result.synced > 0 &&
          `✓ ${result.synced} incident${result.synced === 1 ? "" : "s"} created`}
        {status === "done" &&
          result !== null &&
          result.synced === 0 &&
          "✓ Already up to date"}
        {status === "error" && "✗ Sync failed"}
      </button>

      {status === "done" && result !== null && result.synced > 0 && (
        <span className="text-[10px] text-zinc-600">
          {result.skipped} already tracked
        </span>
      )}
    </div>
  );
}
