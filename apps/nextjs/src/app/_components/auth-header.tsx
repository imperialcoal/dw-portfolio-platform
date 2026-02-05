import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "~/auth/client";

export function AuthHeader() {
  return (
    <header className="flex h-16 items-center justify-end gap-4 p-4">
      <SignedOut>
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
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-10 h-10",
            },
          }}
        />
      </SignedIn>
    </header>
  );
}
