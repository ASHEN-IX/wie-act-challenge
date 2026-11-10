import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveIdentity } from "@noveris/shared/betterAuth";

export type Identity = NonNullable<
  Awaited<ReturnType<typeof resolveIdentity>>
>["identity"];

const getIdentity = cache(async () => resolveIdentity(await headers()));

export async function requireIdentity(
  access: "user" | "admin" | "student" = "user",
): Promise<Identity> {
  const auth = await getIdentity();
  if (!auth) redirect("/login");
  if (access === "admin" && auth.identity.role !== "admin")
    redirect("/dashboard");
  if (access === "student" && auth.identity.role === "admin")
    redirect("/admin/dashboard");
  return auth.identity;
}
