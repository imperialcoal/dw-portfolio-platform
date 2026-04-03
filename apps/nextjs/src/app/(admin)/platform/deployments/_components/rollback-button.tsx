"use client";

import { useState } from "react";

import type { MigrationOperation, RollbackPreflight } from "@dw/contracts";

interface RollbackButtonProps {
  deploymentId: string;
  deploymentUrl: string;
  commitSha: string;
  commitMessage: string;
}

const RISK_STYLES = {
  safe: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    border: "border-green-500/20",
    bg: "bg-green-500/5",
    icon: "✓",
  },
  risky: {
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/5",
    icon: "⚠",
  },
  destructive: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    icon: "✗",
  },
};

function MigrationOperationRow({ op }: { op: MigrationOperation }) {
  const style = RISK_STYLES[op.type];
  return (
    <div className={`rounded border px-3 py-2 ${style.border} ${style.bg}`}>
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 text-[10px] font-bold ${style.badge.split(" ")[1]}`}
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-300">{op.description}</p>
          {op.table && (
            <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
              table: {op.table}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RollbackButton({
  deploymentId,
  deploymentUrl,
  commitSha,
  commitMessage,
}: RollbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<
    "idle" | "loading" | "review" | "confirm" | "executing" | "done" | "error"
  >("idle");
  const [preflight, setPreflight] = useState<RollbackPreflight | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setStep("loading");
    setError(null);

    try {
      const res = await fetch(
        `/api/platform/rollback/preflight?deploymentId=${deploymentId}&commitSha=${commitSha}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RollbackPreflight;
      setPreflight(data);
      setStep("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check migrations",
      );
      setStep("error");
    }
  }

  function closeModal() {
    setOpen(false);
    setStep("idle");
    setPreflight(null);
    setConfirmText("");
    setError(null);
    setResultUrl(null);
  }

  async function executeRollback() {
    if (!preflight) return;

    setStep("executing");
    setError(null);

    try {
      const res = await fetch("/api/platform/rollback/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deploymentId,
          deploymentUrl,
          commitSha,
          overallRisk: preflight.overallRisk,
          confirmText,
          changes: preflight.migrations.flatMap((m) =>
            m.operations
              .filter((op) => op.type !== "safe")
              .map((op) => op.description),
          ),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; details?: string };
        throw new Error(data.details ?? data.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { deploymentUrl?: string };
      setResultUrl(data.deploymentUrl ?? null);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
      setStep("error");
    }
  }

  const canExecute =
    preflight !== null &&
    (preflight.overallRisk !== "destructive" || confirmText === "ROLLBACK");

  return (
    <>
      <button
        onClick={openModal}
        className="cursor-pointer rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
      >
        Rollback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
            {/* Header */}
            <div className="border-b border-white/10 p-5">
              <h3 className="text-sm font-semibold text-zinc-100">
                Rollback Deployment
              </h3>
              <p className="mt-1 font-mono text-[11px] text-zinc-500">
                {commitSha.slice(0, 7)} · {commitMessage.slice(0, 60)}
              </p>
            </div>

            {/* Body */}
            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
              {/* Loading */}
              {step === "loading" && (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-500">
                    Checking for database migrations...
                  </p>
                </div>
              )}

              {/* Error */}
              {step === "error" && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Done */}
              {step === "done" && (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm font-medium text-green-400">
                    ✓ Rollback initiated successfully
                  </p>
                  {resultUrl && (
                    <a
                      href={resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-zinc-400 transition-colors hover:text-zinc-200"
                    >
                      View new deployment →
                    </a>
                  )}
                </div>
              )}

              {/* Review */}
              {(step === "review" || step === "executing") && preflight && (
                <>
                  {/* Migration summary */}
                  <div
                    className={`rounded-lg border p-3 ${
                      RISK_STYLES[preflight.overallRisk].border
                    } ${RISK_STYLES[preflight.overallRisk].bg}`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        preflight.overallRisk === "safe"
                          ? "text-green-400"
                          : preflight.overallRisk === "risky"
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {preflight.summary}
                    </p>
                  </div>

                  {/* Migration details */}
                  {preflight.hasMigrations &&
                    preflight.migrations.map((migration) => (
                      <div key={migration.path} className="space-y-2">
                        <p className="font-mono text-[10px] text-zinc-600">
                          {migration.path}
                        </p>
                        {migration.operations
                          .filter(
                            (op) =>
                              op.type !== "safe" ||
                              migration.riskLevel !== "safe",
                          )
                          .map((op, i) => (
                            <MigrationOperationRow key={i} op={op} />
                          ))}
                      </div>
                    ))}

                  {/* Destructive confirmation */}
                  {preflight.overallRisk === "destructive" && (
                    <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                      <p className="text-xs font-semibold text-red-400">
                        ⚠ This rollback will permanently delete data.
                      </p>
                      <p className="text-xs text-zinc-400">
                        Type{" "}
                        <span className="font-mono font-bold text-red-300">
                          ROLLBACK
                        </span>{" "}
                        to confirm you understand this is irreversible.
                      </p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Type ROLLBACK to confirm"
                        className="w-full rounded border border-red-500/20 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-200 placeholder-zinc-600 focus:border-red-500/40 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Risky warning */}
                  {preflight.overallRisk === "risky" && (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                      <p className="text-xs text-yellow-400">
                        This rollback modifies existing schema. Verify your code
                        is compatible with the rolled-back schema before
                        proceeding.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-white/10 p-5">
              <button
                onClick={closeModal}
                disabled={step === "executing"}
                className="flex-1 cursor-pointer rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {step === "done" ? "Close" : "Cancel"}
              </button>

              {(step === "review" || step === "executing") && preflight && (
                <button
                  onClick={executeRollback}
                  disabled={!canExecute || step === "executing"}
                  className={`flex-1 cursor-pointer rounded-lg border py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    preflight.overallRisk === "destructive"
                      ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : preflight.overallRisk === "risky"
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                        : "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  }`}
                >
                  {step === "executing"
                    ? "Rolling back..."
                    : `Rollback${preflight.overallRisk === "destructive" ? " (Destructive)" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
