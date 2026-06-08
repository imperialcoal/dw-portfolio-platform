// Shared layout for all /platform/* pages.
//
// Access control:
//   DEMO_MODE=true  → recruiter and admin both enter; recruiter sees banner
//   DEMO_MODE=false → admin only; recruiter redirected to / by requireAdmin()
//
// To remove demo mode: delete src/demo/, revert to requireAdmin() only,
// remove isDemoMode import and the isRecruiter banner conditional.

import Link from "next/link";

import { requireAdmin } from "~/auth/require-admin";
import { isDemoMode } from "~/demo";
import { getPlatformAccessLevel } from "~/demo/auth/require-recruiter-or-admin";
import { CommandPalette } from "./_components/command-palette";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isRecruiter = false;

  if (isDemoMode()) {
    const accessLevel = await getPlatformAccessLevel();
    isRecruiter = accessLevel.isRecruiter;
  } else {
    await requireAdmin();
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Recruiter demo session banner — only shown in demo mode */}
      {isRecruiter && <RecruiterBanner />}

      {/* Sticky command palette bar */}
      <div className="bg-background/80 sticky top-0 z-40 border-b border-black/5 px-6 py-3 backdrop-blur-sm lg:px-10 dark:border-white/5">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs transition-colors"
          >
            ← Home
          </Link>
          <div className="flex-1">
            <CommandPalette />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

function RecruiterBanner() {
  return (
    <div className="flex items-center justify-center gap-3 border-b border-sky-500/20 bg-sky-500/8 px-6 py-2.5">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
      </span>
      <p className="text-xs text-sky-300">
        <span className="font-semibold">Recruiter demo session</span>
        <span className="mx-2 text-sky-500">·</span>
        You have full access to the live AI DevOps platform. All actions are
        real — incidents, rollbacks, and agent runs affect live data.
      </p>
    </div>
  );
}
