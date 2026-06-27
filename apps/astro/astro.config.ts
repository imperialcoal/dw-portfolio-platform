import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://portfolio.dw-portfolio.dev",
  output: "static",
  adapter: vercel(),
  integrations: [sitemap()],
});
