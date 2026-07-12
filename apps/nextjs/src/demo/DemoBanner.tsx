// Persistent top-of-page banner shown in the platform dashboard
// when the session role is "recruiter". Informational only.
// Identical to the RecruiterBanner in platform/layout.tsx — exported
// here so demo module controls its own presentation layer.
//
// Used by: apps/nextjs/src/app/(admin)/platform/layout.tsx
// To remove: delete src/demo/ and revert platform/layout.tsx.

export function DemoBanner() {
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
