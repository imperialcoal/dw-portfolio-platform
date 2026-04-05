"use client";

// Manual trigger button for the uptime health check.
// Follows the same pattern as RunDocsAgentButton.
import { useState } from "react";

interface CheckResult {
  name: string;
  status: "up" | "down" | "degraded";
  statusCode: number | null;
  responseTimeMs: number | null;
}

interface TriggerResponse {
  ok: boolean;
  checked: number;
  up: number;
  degraded: number;
  down: number;
  results: CheckResult[];
}

export function RunHealthCheckButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [summary, setSummary] = useState<TriggerResponse | null>(null);

  async function run() {
    setStatus("running");
    setSummary(null);

    try {
      const res = await fetch("/api/platform/health-check/trigger", {
        method: "POST",
      });

      if (res.ok) {
        const data = (await res.json()) as TriggerResponse;
        setSummary(data);
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }

    // Reset to idle after 8s to allow reading the results
    setTimeout(() => {
      setStatus("idle");
      setSummary(null);
    }, 8000);
  }

  return (
    <div className="mt-2 space-y-2">
      <button
        onClick={run}
        disabled={status === "running"}
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-wait"
      >
        {status === "idle" && "↻ Run health check"}
        {status === "running" && "Checking…"}
        {status === "done" &&
          summary !== null &&
          summary.down === 0 &&
          "✓ All systems up"}
        {status === "done" &&
          summary !== null &&
          summary.down > 0 &&
          `✗ ${summary.down} down`}
        {status === "error" && "✗ Failed"}
      </button>

      {/* Inline results summary */}
      {status === "done" && summary !== null && (
        <div className="space-y-1">
          {summary.results.map((r) => (
            <div key={r.name} className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  r.status === "up"
                    ? "bg-emerald-400"
                    : r.status === "degraded"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
              />
              <span className="truncate text-[10px] text-zinc-500">
                {r.name}
              </span>
              {r.responseTimeMs !== null && (
                <span className="ml-auto shrink-0 text-[10px] text-zinc-700 tabular-nums">
                  {r.responseTimeMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
