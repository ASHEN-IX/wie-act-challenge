"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { text, optionalText } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function updateProfile(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api("/api/v1/users/profile", {
      method: "PUT",
      body: JSON.stringify({
        nickname: text(form, "nickname", 80),
        bio: optionalText(form, "bio", 500),
      }),
    });
    revalidatePath("/profile");
    return { success: "Profile updated." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to update profile.",
    };
  }
}
