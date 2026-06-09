// ─────────────────────────────────────────────
// Demo Module — Recruiter Presentation Layer
// ─────────────────────────────────────────────
//
// Activates when DEMO_MODE=true in Doppler stg.
// Self-contained — remove by deleting src/demo/ and reverting these call sites:
//
//   src/app/page.tsx                               → remove isDemoMode() conditional
//   src/app/(admin)/platform/page.tsx              → remove isDemoMode() + DemoIncidentTrigger
//   src/app/(admin)/admin/page.tsx                 → revert to requireAdmin() only
//   src/app/(admin)/platform/layout.tsx            → remove DemoBanner import
//   src/app/api/webhooks/clerk/route.ts            → remove isDemoMode() + getRecruiterEmails()
//   src/app/(admin)/platform/*/page.tsx            → replace DemoDeepLink with plain <a> tags
//   Remove DEMO_MODE + RECRUITER_EMAILS from Doppler stg
//
// ─────────────────────────────────────────────

export { isDemoMode } from "./is-demo-mode";
export { DemoHomePage } from "./DemoHomePage";
export { generateDemoMetadata } from "./demo-metadata";
export { DemoBanner } from "./DemoBanner";
export { DemoIncidentTrigger } from "./triggers/DemoIncidentTrigger";
export { getRecruiterEmails } from "./auth/recruiter-emails";
export { DemoDeepLink } from "./DemoDeepLink";
export { DEMO_TOOLTIPS } from "./demo-deep-links";
export type { DemoTooltipKey } from "./demo-deep-links";
export { isDemoSession } from "./auth/is-demo-session";
