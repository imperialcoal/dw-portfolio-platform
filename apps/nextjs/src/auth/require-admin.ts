import { redirect } from "next/navigation";

import { ROLES } from "@dw/auth";

import { getRequestAuthority } from "./request-authority";

export async function requireAdmin() {
  const authority = await getRequestAuthority();

  console.log("AUTH USER:", authority.userId);
  console.log("DB USER:", authority.user);

  if (authority.user.role !== ROLES.ADMIN) {
    redirect("/");
  }

  return authority;
}
