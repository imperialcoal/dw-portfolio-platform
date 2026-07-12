// Client component that fires synthetic incidents through the real pipeline.
// Lives in the platform dashboard when DEMO_MODE=true.
//
// Each button POSTs to /api/demo/trigger/ci or /api/demo/trigger/sentry,
// which publish to QStash, which calls the real agents, which write to Redis.
// The recruiter then sees the incident appear in the incidents page.
//
// To remove: delete src/demo/ and src/app/api/demo/.

"use client";

import { useState } from "react";

type TriggerType = "ci" | "sentry";
type TriggerState = "idle" | "loading" | "success" | "error";

interface TriggerStatus {
  ci: TriggerState;
  sentry: TriggerState;
}

async function fireTrigger(type: TriggerType): Promise<void> {
  const res = await fetch(`/api/demo/trigger/${type}`, { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

export function DemoIncidentTrigger() {
  const [status, setStatus] = useState<TriggerStatus>({
    ci: "idle",
    sentry: "idle",
  });

  async function trigger(type: TriggerType) {
    setStatus((s) => ({ ...s, [type]: "loading" }));
    try {
      await fireTrigger(type);
      setStatus((s) => ({ ...s, [type]: "success" }));
      setTimeout(() => setStatus((s) => ({ ...s, [type]: "idle" })), 4000);
    } catch {
      setStatus((s) => ({ ...s, [type]: "error" }));
      setTimeout(() => setStatus((s) => ({ ...s, [type]: "idle" })), 4000);
    }
  }

  const TRIGGERS = [
    {
      type: "ci" as const,
      label: "Trigger CI Failure",
      description:
        "Fires a synthetic GitHub CI failure through the real QStash → Anthropic pipeline.",
      icon: "⬡",
      color: "text-zinc-400",
    },
    {
      type: "sentry" as const,
      label: "Trigger Sentry Error",
      description:
        "Fires a synthetic Sentry alert through the real QStash → Anthropic pipeline.",
      icon: "✦",
      color: "text-violet-400",
    },
  ] as const;

  return (
    <div className="border-border bg-muted/20 rounded-xl border p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
        </span>
        <p className="text-foreground text-sm font-semibold">Demo Controls</p>
        <span className="text-muted-foreground/60 ml-auto font-mono text-[10px]">
          Real pipeline · Real agents · Real incidents
        </span>
      </div>

      <p className="text-muted-foreground mb-5 text-xs leading-relaxed">
        Fire a synthetic incident through the live AI pipeline. The Anthropic
        agent will analyze it, classify severity, and create a Redis record.
        Navigate to{" "}
        <span className="text-foreground font-medium">Incidents</span> to see it
        appear and resolve it.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {TRIGGERS.map(({ type, label, description, icon, color }) => {
          const state = status[type];

          return (
            <button
              key={type}
              onClick={() => void trigger(type)}
              disabled={state !== "idle"}
              className="border-border bg-muted/30 hover:bg-muted/60 flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center gap-2">
                <span className={`font-mono text-base ${color}`}>{icon}</span>
                <span className="text-foreground text-xs font-semibold">
                  {state === "loading"
                    ? "Queuing..."
                    : state === "success"
                      ? "✓ Queued — check Incidents"
                      : state === "error"
                        ? "✗ Failed — try again"
                        : label}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
