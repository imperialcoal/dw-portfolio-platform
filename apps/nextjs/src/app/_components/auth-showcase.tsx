import { Button } from "@dw/ui/button";

import { SignInButton } from "~/auth/client";
import { auth, currentUser } from "~/auth/server";

export async function AuthShowcase() {
  const { userId } = await auth();
  const user = userId ? await currentUser() : null;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <p className="text-center text-2xl">You are not signed in</p>
        <SignInButton mode="modal">
          <Button size="lg">Sign in</Button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {user.firstName ?? user.username ?? "User"}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        {user.emailAddresses[0]?.emailAddress}
      </p>
    </div>
  );
}
