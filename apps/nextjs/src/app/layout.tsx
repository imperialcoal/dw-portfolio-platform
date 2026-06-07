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

// ─────────────────────────────────────────────
// Base metadata — portfolio platform foundation.
//
// In demo mode this is overridden by demoMetadata
// from ~/demo. See src/app/page.tsx for the toggle.
// ─────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: url,
  title: "DW Portfolio",
  description:
    "A full-stack portfolio platform with a TypeScript monorepo, tRPC API, Drizzle ORM, Clerk auth, and a production DevOps dashboard.",
  openGraph: {
    title: "DW Portfolio",
    description:
      "Full-stack TypeScript monorepo — Next.js, tRPC, Drizzle, Clerk, Supabase, and a live AI DevOps dashboard.",
    url: url,
    siteName: "DW Portfolio",
  },
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
             * Universal theme toggle — fixed bottom-right, visible on every
             * route. Uses ThemeToggleMenu (dropdown) so Light / Dark / System
             * options are always explicit. z-40 keeps it below modals (z-50).
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
