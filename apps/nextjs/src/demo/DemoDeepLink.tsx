// apps/nextjs/src/demo/DemoDeepLink.tsx
//
// Demo-aware wrapper for external deep links to private service dashboards.
//
// When isDemo=true, renders a disabled button with a tooltip explaining what
// the link connects to — recruiters see the full surface area of the platform
// without accessing private service consoles.
//
// When isDemo=false, renders a standard anchor — zero overhead, zero demo coupling.
//
// Tooltip fix: HTML disabled buttons suppress all mouse events, so onMouseEnter
// never fires. The button is visually disabled via CSS (opacity, cursor, no click
// handler) but NOT via the disabled attribute — mouse events flow normally.
//
// Usage (replaces any bare <a href> deep link on platform pages):
//   import { DemoDeepLink, isDemoMode } from "~/demo";
//   const isDemo = isDemoMode();
//   ...
//   <DemoDeepLink
//     href="https://console.upstash.com/redis"
//     label="Upstash Redis →"
//     tooltip="Live Redis console — browse incident keys, TTLs, and queue state"
//     isDemo={isDemo}
//     className="..."
//   />
//
// To remove demo mode: delete src/demo/ and replace all DemoDeepLink
// usages with plain <a> tags restoring the original href.

"use client";

import { useState } from "react";

import { cn } from "@dw/ui";

interface DemoDeepLinkProps {
  href: string;
  label: string;
  /** Shown in the tooltip when isDemo=true. Describe what the service is and why it requires admin access. */
  tooltip: string;
  /** Pass isDemoMode() from the server component — drives the disabled/live branch. */
  isDemo: boolean;
  className?: string;
}

export function DemoDeepLink({
  href,
  label,
  tooltip,
  isDemo,
  className,
}: DemoDeepLinkProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const baseClassName =
    className ??
    "border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors";

  if (!isDemo) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClassName}
      >
        {label}
      </a>
    );
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {/* Not using the disabled attribute — disabled buttons suppress mouse events,
          which prevents onMouseEnter from firing on the parent div.
          Visual disabled state is achieved via CSS only. */}
      <button
        type="button"
        aria-disabled="true"
        tabIndex={-1}
        onClick={(e) => e.preventDefault()}
        className={cn(
          baseClassName,
          "cursor-not-allowed opacity-40 select-none",
        )}
        aria-label={`${label} — ${tooltip}`}
      >
        {label}
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          className="border-border bg-popover text-popover-foreground absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed shadow-md"
        >
          <p className="text-foreground mb-0.5 font-semibold">
            Admin access only
          </p>
          <p className="text-muted-foreground">{tooltip}</p>
          {/* Caret pointing down toward the button */}
          <div className="border-border bg-popover absolute bottom-[-5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-r border-b" />
        </div>
      )}
    </div>
  );
}
