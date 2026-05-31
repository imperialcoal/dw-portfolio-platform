"use client";

// Triggers the bidirectional advisory sync — creates new advisory incidents
// AND resolves stale ones that are no longer detected in Supabase.
// Works because the browser already carries the Clerk session cookie.
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  ok: boolean;
  synced: number;
  resolved: number;
  total: number;
  skipped: number;
  message?: string;
  error?: string;
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
        // Refresh if anything changed (new incidents or resolved ones)
        if (data.synced > 0 || data.resolved > 0) {
          router.refresh();
        }
      } else {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setResult({
          ok: false,
          synced: 0,
          resolved: 0,
          total: 0,
          skipped: 0,
          message: data?.error ?? "Fetch failed",
        });
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

  function getLabel(): string {
    if (status === "idle") return "↻ Sync to incidents";
    if (status === "running") return "Syncing…";
    if (status === "error") {
      return `✗ ${result?.error ?? result?.message ?? "Error"}`;
    }

    // Done
    if (!result) return "✓ Done";

    const parts: string[] = [];
    if (result.synced > 0) {
      parts.push(`${result.synced} created`);
    }
    if (result.resolved > 0) {
      parts.push(`${result.resolved} resolved`);
    }

    if (parts.length === 0) {
      return "✓ Already in sync";
    }

    return `✓ ${parts.join(", ")}`;
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sync}
        disabled={status === "running"}
        className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 disabled:cursor-wait disabled:opacity-50"
      >
        {getLabel()}
      </button>
    </div>
  );
}
