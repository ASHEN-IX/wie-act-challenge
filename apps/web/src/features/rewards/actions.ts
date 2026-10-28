"use server";
import { requireIdentity } from "@/server/identity";
import { api, segment } from "@/lib/api";
import { text } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
export async function retryLearningReward(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api(
      `/api/v1/users/learning-rewards/evidence/${segment(text(form, "evidenceId", 132))}`,
      {
        method: "POST",
        body: "{}",
      },
    );
    revalidatePath("/progress");
    return {
      success:
        "Reward reconciled. Repeating this request does not award twice.",
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Reward update unavailable; your learning result is retained.",
    };
  }
}
