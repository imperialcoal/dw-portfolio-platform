import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

// site is pinned to the preview domain, not portfolio.dw-portfolio.dev
// (production). Production for this app has never had a deploy triggered —
// see platform/infra/terraform handoff notes — and this Astro portfolio is
// recruiter-facing only for the foreseeable future. Pointing `site` at an
// undeployed domain breaks sitemap generation and canonical-URL correctness
// for the domain that's actually live. Revisit only if/when this app is
// promoted to serve real production traffic.
export default defineConfig({
  site: "https://dev.portfolio.dw-portfolio.dev",
  output: "static",
  adapter: vercel(),
  integrations: [sitemap()],
});
