import { Suspense } from "react";

import { ThemeToggle } from "@dw/ui/theme";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { ContactForm } from "./contact-form";
import { PostCardSkeleton, PostList } from "./posts";

export function HomeContent() {
  prefetch(trpc.post.all.queryOptions());

  return (
    <HydrateClient>
      {/* Site header — minimal chrome with theme toggle */}
      <header className="flex h-14 items-center justify-end border-b px-4 lg:px-8">
        <ThemeToggle />
      </header>

      <main className="container py-16">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Create <span className="text-primary">T3</span> Turbo
          </h1>

          <div className="w-full max-w-2xl overflow-y-scroll">
            <Suspense
              fallback={
                <div className="flex w-full flex-col gap-4">
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                </div>
              }
            >
              <PostList />
            </Suspense>
          </div>
          <ContactForm />
        </div>
      </main>
    </HydrateClient>
  );
}
