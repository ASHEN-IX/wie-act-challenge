"use server";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { text } from "@/lib/validation";
import { requireIdentity } from "@/server/identity";
import type { ActionState } from "@/lib/action-state";

export async function acceptInstitutionInvitation(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const token = text(form, "token", 200);
    if (!/^[A-Za-z0-9_-]{32,200}$/.test(token))
      return { error: "Enter a valid invitation token." };
    await api("/api/v1/study/institutions/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    revalidatePath("/profile");
    return { success: "Institution membership accepted." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to accept the institution invitation.",
    };
  }
}
