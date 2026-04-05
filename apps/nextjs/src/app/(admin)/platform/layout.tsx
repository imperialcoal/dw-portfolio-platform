// Shared layout for all /platform/* pages.
// Renders the CommandPalette (static bar + Cmd+K modal) as a persistent
// chrome layer above page content so it's available everywhere in the platform
// without each page needing to import and mount it individually.
//
// Architecture note:
// - This layout wraps: /platform, /platform/incidents, /platform/deployments,
//   /platform/dependencies, /platform/insights, /platform/users,
//   /platform/database, /platform/docs, and any future platform pages.
// - The CommandPalette is a client component. The layout itself is a server
//   component — Next.js handles the RSC/Client boundary correctly here.
// - The Cmd+K keyboard listener is attached inside CommandPalette's useEffect,
//   so it persists across client-side navigations between platform pages.

import { CommandPalette } from "./_components/command-palette";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Global platform chrome — command palette bar pinned to top */}
      <div className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 px-6 py-3 backdrop-blur-sm lg:px-10">
        <CommandPalette />
      </div>

      {/* Page content — each page provides its own padding and max-width */}
      {children}
    </div>
  );
}
