"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: "incident" | "deployment" | "user_activity" | "deeplink";
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  externalHref?: string;
  severity?: string;
  timestamp?: string;
}

const TYPE_ICONS: Record<SearchResult["type"], string> = {
  deeplink: "⌘",
  incident: "⚠",
  deployment: "▲",
  user_activity: "◎",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-green-400",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // openPalette resets all state before opening so the palette is always clean
  const openPalette = useCallback(() => {
    setQuery("");
    setResults([]);
    setSelected(0);
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
  }, []);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Toggle: if already open, close; otherwise open fresh
        setOpen((prev) => {
          if (prev) return false;
          // Side-effect: reset state before showing
          setQuery("");
          setResults([]);
          setSelected(0);
          return true;
        });
      }
      if (e.key === "Escape") {
        closePalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePalette]);

  // Focus the input after the modal mounts — pure DOM side-effect, no setState
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Debounced search — only runs while open
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const params = new URLSearchParams({ q: query });
        const res = await fetch(`/api/platform/search?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results);
          setSelected(0);
        }
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  function navigate(result: SearchResult) {
    closePalette();
    if (result.externalHref) {
      window.open(result.externalHref, "_blank", "noopener,noreferrer");
    } else if (result.href) {
      router.push(result.href);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      navigate(results[selected]);
    }
  }

  return (
    <>
      {/* Static search trigger bar — always visible */}
      <button
        onClick={openPalette}
        className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-zinc-500 transition-colors hover:border-white/20 hover:bg-white/10"
      >
        <span className="text-xs">⌘</span>
        <span className="flex-1">Search deployments, incidents, users…</span>
        <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
          ⌘K
        </kbd>
      </button>

      {/* Modal overlay — conditionally rendered so stale state is never visible */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 pt-[15vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePalette();
          }}
        >
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <span className="text-zinc-600">
                {isPending ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-zinc-400" />
                ) : (
                  "⌘"
                )}
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search deployments, incidents, users, tables…"
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
              />
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                esc
              </kbd>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="max-h-96 overflow-y-auto py-2">
                {results.map((result, idx) => (
                  <button
                    key={result.id}
                    onClick={() => navigate(result)}
                    onMouseEnter={() => setSelected(idx)}
                    className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                      idx === selected ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-sm text-zinc-600">
                      {TYPE_ICONS[result.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          result.severity
                            ? (SEVERITY_COLORS[result.severity] ??
                              "text-zinc-200")
                            : "text-zinc-200"
                        }`}
                      >
                        {result.title}
                      </p>
                      <p className="truncate text-xs text-zinc-600">
                        {result.subtitle}
                      </p>
                    </div>
                    {result.externalHref && (
                      <span className="shrink-0 text-[10px] text-zinc-700">
                        external ↗
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && !isPending && (
              <div className="px-4 py-8 text-center text-sm text-zinc-600">
                No results for &quot;{query}&quot;
              </div>
            )}

            {/* Footer hints */}
            <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2">
              <span className="text-[10px] text-zinc-700">↑↓ navigate</span>
              <span className="text-[10px] text-zinc-700">↵ open</span>
              <span className="text-[10px] text-zinc-700">esc close</span>
              <span className="ml-auto text-[10px] text-zinc-700">
                incidents · deployments · users · links
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
