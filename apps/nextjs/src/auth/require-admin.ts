import { redirect } from "next/navigation";

import { ROLES } from "@dw/auth";

import { getRequestAuthority } from "./request-authority";

export async function requireAdmin() {
  const authority = await getRequestAuthority();

  if (authority.user.role !== ROLES.ADMIN) {
    redirect("/");
  }

  return authority;
}
