import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cn } from "@dw/ui";
import { ThemeProvider, ThemeToggle } from "@dw/ui/theme";
import { Toaster } from "@dw/ui/toast";

import { ClerkProvider } from "~/auth/client";
import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

const url = new URL(env.NEXT_PUBLIC_APP_URL);

export const metadata: Metadata = {
  metadataBase: url,
  title: "DW Portfolio",
  description: "Simple monorepo with shared backend for web & mobile apps",
  openGraph: {
    title: "DW Portfolio",
    description: "Simple monorepo with shared backend for web & mobile apps",
    url: url,
    siteName: "DW Portfolio",
  },
  twitter: {
    card: "summary_large_image",
    site: "@my_twitter",
    creator: "@my_twitter",
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
            <div className="absolute right-4 bottom-4">
              <ThemeToggle />
            </div>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
