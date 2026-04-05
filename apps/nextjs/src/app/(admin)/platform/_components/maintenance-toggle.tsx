"use client";

// Big red button for enabling/disabling maintenance mode.
// Reads current state, shows a confirmation dialog before enabling.
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { MaintenanceMode } from "@dw/contracts";

export function MaintenanceToggle({
  initial,
}: {
  initial: MaintenanceMode | null;
}) {
  const [mode, setMode] = useState<MaintenanceMode | null>(initial);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState(
    "We're performing scheduled maintenance. Back shortly.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isActive = mode?.enabled === true;

  async function toggle(enable: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: enable,
          message: enable ? message : "",
          enabledBy: "admin",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMode(
        enable
          ? {
              enabled: true,
              message,
              enabledAt: new Date().toISOString(),
              enabledBy: "admin",
            }
          : null,
      );
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Current state indicator */}
      <div
        className={`flex items-center justify-between rounded-xl border p-5 ${
          isActive
            ? "border-red-500/30 bg-red-500/10"
            : "border-white/10 bg-white/5"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${isActive ? "animate-pulse bg-red-500" : "bg-zinc-600"}`}
            />
            <p
              className={`text-sm font-semibold ${isActive ? "text-red-400" : "text-zinc-400"}`}
            >
              {isActive ? "Maintenance Mode Active" : "Maintenance Mode Off"}
            </p>
          </div>
          {isActive && mode.message && (
            <p className="mt-1 text-xs text-zinc-500">{mode.message}</p>
          )}
          {isActive && mode.enabledAt && (
            <p className="mt-0.5 text-[10px] text-zinc-700">
              Enabled {new Date(mode.enabledAt).toLocaleString()}
            </p>
          )}
          {!isActive && (
            <p className="mt-1 text-xs text-zinc-600">
              All public traffic is flowing normally
            </p>
          )}
        </div>

        <div>
          {isActive ? (
            <button
              onClick={() => toggle(false)}
              disabled={loading}
              className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Disabling…" : "Disable"}
            </button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              Enable Maintenance
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-red-400">
              ⚠ Enable Maintenance Mode
            </h3>
            <p className="mt-2 text-xs text-zinc-400">
              All non-admin traffic to the production site will see a
              maintenance page. This takes effect immediately.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                Maintenance Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="w-full rounded border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-white/20 focus:outline-none"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => toggle(true)}
                disabled={loading}
                className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Enabling…" : "Enable Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
