import { DemoHomePage, isDemoMode } from "~/demo";
import { HomeContent } from "./_components/home-content";

// Root home route.
//
// Renders the recruiter-facing demo landing page when DEMO_MODE=true
// (set in Doppler `stg` for the preview environment during recruitment).
//
// Renders the base portfolio home page otherwise — a simple post list
// that represents what this platform is ultimately for.
//
// To exit demo mode permanently:
//   1. Set DEMO_MODE=false (or remove it) in Doppler
//   2. Delete src/demo/
//   3. Remove the isDemoMode import and conditional below
//   4. Remove the demoMetadata export from this file if present

export const dynamic = "force-dynamic";

export { generateDemoMetadata as generateMetadata } from "~/demo";

export default function HomePage() {
  if (isDemoMode()) {
    return <DemoHomePage />;
  }
  return <HomeContent />;
}
