"use client";

// Clerk Core 3 (v7) migration:
// SignedIn, SignedOut, and Protect are removed in favour of the unified <Show> component.
// Usage:
//   <Show when="signed-in">...</Show>    (replaces <SignedIn>)
//   <Show when="signed-out">...</Show>   (replaces <SignedOut>)
export {
  ClerkProvider,
  useAuth,
  useUser,
  useClerk,
  SignInButton,
  SignUpButton,
  UserButton,
  Show,
} from "@clerk/nextjs";
