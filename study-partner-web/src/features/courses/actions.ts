"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, segment } from "@/lib/api";
import { text, optionalText } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function createSubject(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api("/api/v1/study/subjects", {
      method: "POST",
      body: JSON.stringify({
        name: text(form, "name", 100),
        description: optionalText(form, "description"),
      }),
    });
    revalidatePath("/courses");
    revalidatePath("/courses/new");
    return { success: "Subject created." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to create subject.",
    };
  }
}
export async function uploadCourse(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  let id: string;
  try {
    const body = new FormData();
    body.set("title", text(form, "title", 150));
    body.set("subject_id", text(form, "subject_id", 150));
    body.set("description", optionalText(form, "description"));
    const files = form.getAll("files");
    if (
      files.reduce(
        (sum, file) => sum + (file instanceof File ? file.size : 0),
        0,
      ) >
      25 * 1024 * 1024
    )
      return { error: "Keep the total upload under 25 MB." };
    if (!files.length || files.length > 10)
      return { error: "Choose between 1 and 10 PDF files." };
    for (const file of files) {
      if (
        !(file instanceof File) ||
        !file.size ||
        file.size > 25 * 1024 * 1024 ||
        !file.name.toLowerCase().endsWith(".pdf") ||
        file.type !== "application/pdf"
      )
        return { error: "Choose PDF files up to 25 MB each." };
      body.append("files", file);
    }
    const response = await api<{ courseId: string }>("/api/v1/study/courses", {
      method: "POST",
      body,
    });
    id = response.courseId;
    revalidatePath("/courses");
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Upload failed." };
  }
  redirect(`/courses/${segment(id)}`);
}
export async function deleteCourse(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    if (text(form, "confirmation") !== "DELETE")
      return { error: "Type DELETE to confirm." };
    await api(`/api/v1/study/courses/${segment(text(form, "id"))}`, {
      method: "DELETE",
    });
    revalidatePath("/courses");
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to delete course.",
    };
  }
  redirect("/courses");
}
