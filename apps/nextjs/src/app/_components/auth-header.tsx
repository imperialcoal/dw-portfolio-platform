"use client";

import { ThemeToggle } from "@dw/ui/theme";

import {
  Show,
  SignInButton,
  SignUpButton,
  useAuth,
  UserButton,
} from "~/auth/client";

export function AuthHeader() {
  const { isLoaded } = useAuth();

  return (
    <header className="flex h-16 items-center justify-end gap-4 p-4">
      {!isLoaded ? (
        <div className="h-10 w-10" />
      ) : (
        <>
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="text-foreground hover:text-primary transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 font-medium transition-colors">
                Sign Up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
            />
          </Show>
        </>
      )}
    </header>
  );
}
