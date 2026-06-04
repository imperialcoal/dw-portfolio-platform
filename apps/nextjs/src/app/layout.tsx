import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cn } from "@dw/ui";
import { ThemeProvider, ThemeToggleMenu } from "@dw/ui/theme";
import { Toaster } from "@dw/ui/toast";

import { ClerkProvider } from "~/auth/client";
import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

const url = new URL(env.NEXT_PUBLIC_APP_URL);

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            "bg-background text-foreground min-h-screen font-sans antialiased",
            geistSans.variable,
            geistMono.variable,
          )}
        >
          <ThemeProvider>
            <TRPCReactProvider>{props.children}</TRPCReactProvider>
            {/*
             * Universal theme toggle — fixed bottom-right, visible on every route.
             * Uses ThemeToggleMenu (dropdown) so Light / Dark / System options
             * are always explicit. z-40 keeps it below modals (z-50).
             */}
            <div className="fixed right-4 bottom-4 z-40">
              <ThemeToggleMenu />
            </div>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
