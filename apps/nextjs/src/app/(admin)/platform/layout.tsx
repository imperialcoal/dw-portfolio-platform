// apps/nextjs/src/app/(admin)/platform/layout.tsx
//
// Shared layout for all /platform/* pages.
// - Renders the sticky CommandPalette bar at the top
// - Renders a read-only demo banner when the session role is "viewer"
//
// Note: isReadOnly is derived from getPlatformAccessLevel(), which compares
// the DB role string internally. No need to import ROLES here.

import { getPlatformAccessLevel } from "~/auth/require-viewer-or-admin";
import { CommandPalette } from "./_components/command-palette";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforces viewer-or-admin gate for all /platform/* pages.
  // Users without platform access are redirected to / by the guard.
  const { isReadOnly } = await getPlatformAccessLevel();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Read-only demo banner — visible only for viewer role */}
      {isReadOnly && <ViewerBanner />}

      {/* Global platform chrome — command palette bar pinned to top */}
      <div className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 px-6 py-3 backdrop-blur-sm lg:px-10">
        <CommandPalette />
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// ViewerBanner
// Displayed at the top of the platform for demo/recruiter accounts.
// ─────────────────────────────────────────────

function ViewerBanner() {
  return (
    <div className="flex items-center justify-center gap-3 border-b border-sky-500/20 bg-sky-500/8 px-6 py-2.5">
      {/* Pulse dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
      </span>

      <p className="text-xs text-sky-300">
        <span className="font-semibold">Read-only demo access</span>
        <span className="mx-2 text-sky-500">·</span>
        You&apos;re viewing live production data from the AI DevOps platform.
        Actions that modify system state are disabled.
      </p>

      <a
        href="https://github.com/imperialcoal/dw-portfolio-platform"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto shrink-0 rounded border border-sky-500/30 px-2.5 py-1 text-[11px] font-medium text-sky-400 transition-colors hover:border-sky-400/60 hover:text-sky-300"
      >
        View source →
      </a>
    </div>
  );
}
