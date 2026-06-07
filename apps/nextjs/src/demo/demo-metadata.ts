// Next.js generateMetadata export for the demo landing page.
// Used in src/app/page.tsx when DEMO_MODE=true.
//
// Returns recruiter-optimized metadata: descriptive title, OG tags,
// and keywords that surface the platform's engineering story.

import type { Metadata } from "next";

import { env } from "~/env";

export function generateDemoMetadata(): Metadata {
  const url = new URL(env.NEXT_PUBLIC_APP_URL);

  return {
    metadataBase: url,
    title: "Platform Intelligence — DW Portfolio",
    description:
      "A production-grade AI DevOps platform: automated incident pipeline powered by Anthropic, Terraform-managed infrastructure across two environments, and a live control center dashboard. Built as a portfolio project.",
    openGraph: {
      title: "Platform Intelligence — DW Portfolio",
      description:
        "AI-powered incident pipeline + Terraform IaC + full-stack TypeScript monorepo. Live production system.",
      url: url,
      siteName: "DW Portfolio",
    },
    keywords: [
      "DevOps",
      "AI",
      "TypeScript",
      "Next.js",
      "Terraform",
      "tRPC",
      "Drizzle",
      "Supabase",
      "Turborepo",
      "portfolio",
    ],
  };
}
