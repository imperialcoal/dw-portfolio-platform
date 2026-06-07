// ─────────────────────────────────────────────
// Demo Module — Recruiter Presentation Layer
// ─────────────────────────────────────────────
//
// This module replaces the base portfolio home page with a recruiter-facing
// landing page when DEMO_MODE=true in Doppler.
//
// It is intentionally self-contained so it can be removed cleanly:
//
//   To remove demo mode:
//     1. Set DEMO_MODE=false in Doppler (or delete the variable)
//     2. Delete this entire src/demo/ directory
//     3. In src/app/page.tsx, remove the isDemoMode() conditional and
//        the generateDemoMetadata export — revert to a plain export default
//     4. In src/app/(admin)/platform/page.tsx, remove the isDemoMode()
//        conditional and DemoIncidentTrigger import
//     5. In src/app/(admin)/admin/page.tsx, revert to requireAdmin() only
//     6. Done — zero traces in the core codebase
//
// ─────────────────────────────────────────────

export { isDemoMode } from "./is-demo-mode";
export { DemoHomePage } from "./DemoHomePage";
export { generateDemoMetadata } from "./demo-metadata";
export { DemoBanner } from "./DemoBanner";
export { DemoIncidentTrigger } from "./triggers/DemoIncidentTrigger";
