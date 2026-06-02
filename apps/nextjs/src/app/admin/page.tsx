// apps/nextjs/src/app/admin/page.tsx
//
// Clerk authentication showcase.
//
// This page demonstrates role-based access control:
//   - Any visitor sees the public post board and a clear sign-in prompt
//   - Authenticated admin users additionally see a Create Post form
//     and Delete buttons on each post
//
// The tRPC layer enforces these roles server-side — this UI
// just reflects what the API permits.

import { Suspense } from "react";
import Link from "next/link";

import { Show, SignInButton } from "~/auth/client";
import {
  CreatePostForm,
  PostCardSkeleton,
  PostList,
} from "../_components/posts";
import { requireAdmin } from "../../auth/require-admin";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-border flex h-14 items-center justify-between border-b px-6 lg:px-10">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          ← Home
        </Link>
        <span className="text-foreground text-sm font-semibold">Auth Demo</span>
        <Link
          href="/platform"
          className="bg-foreground text-background rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        >
          Platform →
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 lg:px-10">
        {/* Clerk auth context banner */}
        <div className="border-border bg-muted/40 mb-8 rounded-xl border p-5">
          <p className="text-foreground mb-1 text-sm font-semibold">
            Clerk Authentication Demo
          </p>
          <p className="text-muted-foreground text-sm">
            This page uses Clerk for role-based access control. Sign in as an
            admin to create and delete posts. Visitors can only read.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="border-border bg-muted/60 text-muted-foreground rounded border px-2.5 py-1">
              <span className="text-green-500">✓</span> Read — anyone
            </span>
            <span className="border-border bg-muted/60 text-muted-foreground rounded border px-2.5 py-1">
              <span className="text-amber-500">⚿</span> Create — admin only
            </span>
            <span className="border-border bg-muted/60 text-muted-foreground rounded border px-2.5 py-1">
              <span className="text-red-500">⚿</span> Delete — admin only
            </span>
          </div>
        </div>

        {/* Admin-only: create post form */}
        <Show when="signed-in">
          <div className="mb-8">
            <h2 className="text-foreground mb-4 text-sm font-semibold tracking-widest uppercase">
              Create Post
            </h2>
            <CreatePostForm />
          </div>
        </Show>

        {/* Signed-out: sign-in prompt */}
        <Show when="signed-out">
          <div className="border-border bg-muted/40 mb-8 rounded-xl border p-5 text-center">
            <p className="text-foreground mb-1 text-sm font-medium">
              Sign in to create posts
            </p>
            <p className="text-muted-foreground mb-4 text-xs">
              Admin accounts can create and delete posts via the tRPC API.
            </p>
            <SignInButton mode="modal">
              <button className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80">
                Sign In with Clerk
              </button>
            </SignInButton>
          </div>
        </Show>

        {/* Public post board */}
        <div>
          <h2 className="text-muted-foreground mb-4 text-sm font-semibold tracking-widest uppercase">
            Post Board
          </h2>
          <Suspense
            fallback={
              <div className="flex flex-col gap-3">
                <PostCardSkeleton />
                <PostCardSkeleton />
              </div>
            }
          >
            <PostList />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
