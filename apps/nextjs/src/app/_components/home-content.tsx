"use client";

import { Suspense } from "react";
import Link from "next/link";

import { SignInButton } from "~/auth/client";
import { PostCardSkeleton, PostList } from "./posts";

// ─────────────────────────────────────────────
// HomeContent
//
// The base home page for the portfolio platform.
// Displays the public post list and a sign-in prompt.
//
// Demo mode replaces this entirely via ~/demo — see
// src/app/page.tsx for the isDemoMode() toggle.
// ─────────────────────────────────────────────

export function HomeContent() {
  return (
    <div className="bg-background min-h-screen">
      {/* Nav */}
      <nav className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
          <span className="text-foreground text-sm font-semibold tracking-tight">
            DW Portfolio
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Admin
            </Link>
            <Link
              href="/platform"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Platform
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            Posts
          </h1>
          <SignInButton mode="modal">
            <button className="text-muted-foreground hover:text-foreground border-border rounded-md border px-3 py-1.5 text-xs transition-colors">
              Sign in to create
            </button>
          </SignInButton>
        </div>

        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          }
        >
          <PostList />
        </Suspense>
      </main>
    </div>
  );
}
