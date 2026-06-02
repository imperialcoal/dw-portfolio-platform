// Shared layout for all /platform/* pages.
// - Renders the sticky CommandPalette bar at the top
// - Renders a read-only demo banner when the session role is "viewer"
//
// Theme: uses bg-background / text-foreground tokens on the root wrapper
// so the global ThemeToggleMenu (fixed bottom-right in root layout.tsx)
// works identically here as on every other route. No inline toggle needed —
// the universal one in the root layout covers /platform/* automatically.

import { getPlatformAccessLevel } from "~/auth/require-viewer-or-admin";
import { CommandPalette } from "./_components/command-palette";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isReadOnly } = await getPlatformAccessLevel();

  return (
    <div className="bg-background text-foreground min-h-screen">
      {isReadOnly && <ViewerBanner />}

      {/* Sticky command palette bar */}
      <div className="bg-background/80 sticky top-0 z-40 border-b border-black/5 px-6 py-3 backdrop-blur-sm lg:px-10 dark:border-white/5">
        <CommandPalette />
      </div>

      {children}
    </div>
  );
}

function ViewerBanner() {
  return (
    <div className="flex items-center justify-center gap-3 border-b border-sky-500/20 bg-sky-500/8 px-6 py-2.5">
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
    </div>
  );
}
