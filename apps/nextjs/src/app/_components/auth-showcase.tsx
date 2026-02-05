// import { headers } from "next/headers";
// import { redirect } from "next/navigation";
// import { Button } from "@dw/ui/button";

// import { auth, getSession } from "~/auth/server";

// export async function AuthShowcase() {
//   const session = await getSession();

//   if (!session) {
//     return (
//       <form>
//         <Button
//           size="lg"
//           formAction={async () => {
//             "use server";
//             const res = await auth.api.signInSocial({
//               body: {
//                 provider: "discord",
//                 callbackURL: "/",
//               },
//             });
//             if (!res.url) {
//               throw new Error("No URL returned from signInSocial");
//             }
//             redirect(res.url);
//           }}
//         >
//           Sign in with Discord
//         </Button>
//       </form>
//     );
//   }

//   return (
//     <div className="flex flex-col items-center justify-center gap-4">
//       <p className="text-center text-2xl">
//         <span>Logged in as {session.user.name}</span>
//       </p>

//       <form>
//         <Button
//           size="lg"
//           formAction={async () => {
//             "use server";
//             await auth.api.signOut({
//               headers: await headers(),
//             });
//             redirect("/");
//           }}
//         >
//           Sign out
//         </Button>
//       </form>
//     </div>
//   );
// }

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
