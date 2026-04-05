"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  BreakingChangeAnalysis,
  DependabotPR,
  MergeResult,
  SecurityAlertWithPR,
} from "@dw/contracts";

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const UPDATE_TYPE_STYLES = {
  major: "bg-red-500/10 text-red-400 border-red-500/20",
  minor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  patch: "bg-green-500/10 text-green-400 border-green-500/20",
  unknown: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const SEVERITY_STYLES = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-green-500/10 text-green-400 border-green-500/20",
};

const RECOMMENDATION_STYLES = {
  "merge-safely": "text-green-400",
  "review-required": "text-yellow-400",
  "block-merge": "text-red-400",
};

const RECOMMENDATION_LABELS = {
  "merge-safely": "✅ Safe to merge",
  "review-required": "⚠️ Review required",
  "block-merge": "🚫 Do not merge",
};

// ─────────────────────────────────────────────
// PR Row
// ─────────────────────────────────────────────

function PRRow({
  pr,
  analysis,
  checked,
  onToggle,
  onAnalyze,
  analyzing,
}: {
  pr: DependabotPR;
  analysis: BreakingChangeAnalysis | undefined;
  checked: boolean;
  onToggle: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <div className="flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded accent-indigo-500"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 uppercase">
              Dependabot PR
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${UPDATE_TYPE_STYLES[pr.updateType]}`}
            >
              {pr.updateType}
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {pr.ecosystem}
            </span>
            {analysis && (
              <span
                className={`text-[10px] font-semibold ${RECOMMENDATION_STYLES[analysis.recommendation]}`}
              >
                {RECOMMENDATION_LABELS[analysis.recommendation]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-200">
            {pr.packageName}
            {pr.fromVersion && pr.toVersion && (
              <span className="ml-2 font-mono text-xs text-zinc-500">
                {pr.fromVersion} → {pr.toVersion}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pr.isMajor && !pr.hasAnalysis && (
            <button
              onClick={onAnalyze}
              disabled={analyzing}
              className="cursor-pointer rounded border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-400 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? "Analyzing..." : "Analyze"}
            </button>
          )}
          {analysis && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {expanded ? "Hide" : "Show analysis"}
            </button>
          )}
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            PR #{pr.number} →
          </a>
        </div>
      </div>

      {/* Analysis panel */}
      {expanded && analysis && (
        <div className="space-y-3 border-t border-white/5 bg-black/20 p-4">
          <p className="text-xs text-zinc-300">{analysis.summary}</p>
          {analysis.breakingChanges.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                Breaking Changes
              </p>
              <ul className="space-y-0.5">
                {analysis.breakingChanges.map((c, i) => (
                  <li key={i} className="text-xs text-red-300">
                    • {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.affectedAreas.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                Affected Areas
              </p>
              <ul className="space-y-0.5">
                {analysis.affectedAreas.map((a, i) => (
                  <li key={i} className="text-xs text-zinc-400">
                    • {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.migrationSteps.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                Migration Steps
              </p>
              <ol className="space-y-0.5">
                {analysis.migrationSteps.map((s, i) => (
                  <li key={i} className="text-xs text-zinc-400">
                    {i + 1}. {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Security Alert Row
// ─────────────────────────────────────────────

function SecurityAlertRow({ alert }: { alert: SecurityAlertWithPR }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-400 uppercase">
              Security Alert
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[alert.severity]}`}
            >
              {alert.severity}
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {alert.ecosystem}
            </span>
            {alert.noFixAvailable ? (
              <span className="rounded border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-400">
                No fix available
              </span>
            ) : (
              <span className="rounded border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">
                Fix PR available
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-200">
            {alert.packageName}
            {alert.identifier && (
              <span className="ml-2 font-mono text-xs text-zinc-500">
                {alert.identifier}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{alert.summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {alert.fixPR && (
            <a
              href={alert.fixPR.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-green-400 transition-colors hover:text-green-200"
            >
              Fix PR #{alert.fixPR.number} →
            </a>
          )}
          {alert.alertUrl && (
            <a
              href={alert.alertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              View alert →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Merge Results Toast
// ─────────────────────────────────────────────

function MergeResultsToast({
  results,
  onDismiss,
}: {
  results: MergeResult[];
  onDismiss: () => void;
}) {
  const merged = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  return (
    <div className="fixed right-6 bottom-6 z-50 w-80 rounded-xl border border-white/10 bg-zinc-900 p-4 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          {merged.length > 0 && (
            <p className="text-sm font-medium text-green-400">
              ✓ Merged {merged.length} PR{merged.length === 1 ? "" : "s"}
            </p>
          )}
          {failed.length > 0 && (
            <div className="mt-1">
              <p className="text-sm font-medium text-red-400">
                ✗ Failed: {failed.length} PR{failed.length === 1 ? "" : "s"}
              </p>
              {failed.map((f) => (
                <p key={f.prNumber} className="mt-0.5 text-xs text-zinc-500">
                  PR #{f.prNumber}: {f.error}
                </p>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────

export function DependencyManagerClient({
  prs,
  securityAlerts,
  analyses: initialAnalyses,
}: {
  prs: DependabotPR[];
  securityAlerts: SecurityAlertWithPR[];
  analyses: Record<number, BreakingChangeAnalysis>;
}) {
  const router = useRouter();
  const [selectedPRs, setSelectedPRs] = useState<Set<number>>(new Set());
  const [analyses, setAnalyses] =
    useState<Record<number, BreakingChangeAnalysis>>(initialAnalyses);
  const [analyzingPR, setAnalyzingPR] = useState<number | null>(null);
  const [mergeResults, setMergeResults] = useState<MergeResult[] | null>(null);
  const [isMerging, startMerging] = useTransition();

  const majorPRs = prs.filter((pr) => pr.isMajor);
  const minorPatchPRs = prs.filter((pr) => !pr.isMajor);
  const allCheckable = [...prs];

  const allSelected =
    allCheckable.length > 0 &&
    allCheckable.every((pr) => selectedPRs.has(pr.number));

  const someSelected = selectedPRs.size > 0;

  // Check if any selected PR has a "block-merge" analysis
  const hasBlockedPR = [...selectedPRs].some(
    (n) => analyses[n]?.recommendation === "block-merge",
  );

  function toggleAll() {
    if (allSelected) {
      setSelectedPRs(new Set());
    } else {
      setSelectedPRs(new Set(allCheckable.map((pr) => pr.number)));
    }
  }

  function togglePR(number: number) {
    setSelectedPRs((prev) => {
      const next = new Set(prev);
      if (next.has(number)) {
        next.delete(number);
      } else {
        next.add(number);
      }
      return next;
    });
  }

  async function handleAnalyze(pr: DependabotPR) {
    setAnalyzingPR(pr.number);
    try {
      const res = await fetch("/api/platform/deps/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prNumber: pr.number }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          analysis?: BreakingChangeAnalysis;
        };
        if (data.analysis) {
          const analysis = data.analysis;

          setAnalyses((prev) => ({
            ...prev,
            [pr.number]: analysis,
          }));
        }
      }
    } finally {
      setAnalyzingPR(null);
    }
  }

  function handleMerge() {
    startMerging(async () => {
      const prNumbers = [...selectedPRs];
      const res = await fetch("/api/platform/deps/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prNumbers }),
      });
      const data = (await res.json()) as { results?: MergeResult[] };
      if (data.results) {
        setMergeResults(data.results);
        const mergedNums = new Set(
          data.results.filter((r) => r.success).map((r) => r.prNumber),
        );
        setSelectedPRs((prev) => {
          const next = new Set(prev);
          for (const n of mergedNums) next.delete(n);
          return next;
        });
        // Refresh server data so merged PRs disappear from the list
        if (mergedNums.size > 0) {
          router.refresh();
        }
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Bulk action bar */}
      {prs.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 cursor-pointer rounded accent-indigo-500"
            />
            <span className="text-xs text-zinc-400">
              {allSelected ? "Deselect all" : `Select all (${prs.length})`}
            </span>
          </label>

          {someSelected && (
            <>
              <span className="text-xs text-zinc-500">
                {selectedPRs.size} selected
              </span>
              {hasBlockedPR && (
                <span className="text-xs text-red-400">
                  ⚠ Selection includes PRs flagged as risky — review before
                  merging
                </span>
              )}
              <button
                onClick={handleMerge}
                disabled={isMerging}
                className="ml-auto cursor-pointer rounded border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMerging
                  ? "Merging..."
                  : `Merge ${selectedPRs.size} PR${selectedPRs.size === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Major version PRs */}
      {majorPRs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Major Updates
            </h2>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
              {majorPRs.length}
            </span>
            <span className="text-[10px] text-zinc-700">
              — Breaking change analysis available
            </span>
          </div>
          {majorPRs.map((pr) => (
            <PRRow
              key={pr.number}
              pr={pr}
              analysis={analyses[pr.number]}
              checked={selectedPRs.has(pr.number)}
              onToggle={() => togglePR(pr.number)}
              onAnalyze={() => handleAnalyze(pr)}
              analyzing={analyzingPR === pr.number}
            />
          ))}
        </section>
      )}

      {/* Minor / patch PRs */}
      {minorPatchPRs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Minor & Patch Updates
            </h2>
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
              {minorPatchPRs.length}
            </span>
            <span className="text-[10px] text-zinc-700">
              — Generally safe to merge
            </span>
          </div>
          {minorPatchPRs.map((pr) => (
            <PRRow
              key={pr.number}
              pr={pr}
              analysis={analyses[pr.number]}
              checked={selectedPRs.has(pr.number)}
              onToggle={() => togglePR(pr.number)}
              onAnalyze={() => handleAnalyze(pr)}
              analyzing={analyzingPR === pr.number}
            />
          ))}
        </section>
      )}

      {/* Security alerts */}
      {securityAlerts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Security Alerts
            </h2>
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
              {securityAlerts.length}
            </span>
            <span className="text-[10px] text-zinc-700">
              — Fix via Dependabot PR or manual update
            </span>
          </div>
          {securityAlerts.map((alert) => (
            <SecurityAlertRow key={alert.alertId} alert={alert} />
          ))}
        </section>
      )}

      {prs.length === 0 && securityAlerts.length === 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <p className="text-sm font-medium text-emerald-400">
            All dependencies are up to date
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            No open Dependabot PRs or security alerts
          </p>
        </div>
      )}

      {/* Merge results toast */}
      {mergeResults && (
        <MergeResultsToast
          results={mergeResults}
          onDismiss={() => setMergeResults(null)}
        />
      )}
    </div>
  );
}
