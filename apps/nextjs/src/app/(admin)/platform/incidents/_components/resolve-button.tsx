"use client";

import { useState } from "react";

import type { IncidentStatus } from "@dw/contracts";
import { INCIDENT_STATUSES } from "@dw/contracts";

interface ResolveButtonProps {
  incidentId: string;
  currentStatus: IncidentStatus;
  onResolved: () => void;
}

export function ResolveButton({
  incidentId,
  currentStatus,
  onResolved,
}: ResolveButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<IncidentStatus>("resolved");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show the button for already-closed incidents
  if (currentStatus === "closed") return null;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/incidents/${incidentId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
      >
        Resolve
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-sm font-semibold text-zinc-100">
              Manually resolve incident
            </h3>

            <div className="mb-4">
              <label className="mb-1.5 block text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
                New Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-white/20 focus:outline-none"
              >
                {INCIDENT_STATUSES.filter((s) => s !== currentStatus).map(
                  (s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is this being resolved manually?"
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-white/20 focus:outline-none"
              />
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={loading}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 rounded-lg border border-green-500/20 bg-green-500/10 py-2 text-sm text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
