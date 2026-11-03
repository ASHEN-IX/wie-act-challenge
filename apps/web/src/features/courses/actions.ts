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
    const result = await api<{ subject: { id: string; name: string } }>(
      "/api/v1/study/subjects",
      {
      method: "POST",
      body: JSON.stringify({
        name: text(form, "name", 100),
        description: optionalText(form, "description"),
      }),
      },
    );
    revalidatePath("/courses");
    revalidatePath("/courses/new");
    return { success: "Subject created.", createdSubject: result.subject };
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
    const institutionId = optionalText(form, "institutionId");
    if (institutionId) {
      body.set("institutionId", segment(institutionId));
      body.set("scope", "institutional");
    }
    const files = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
    if (
      files.reduce(
        (sum, file) => sum + (file instanceof File ? file.size : 0),
        0,
      ) >
      25 * 1024 * 1024
    )
      return { error: "Keep the total upload under 25 MB." };
    if (!files.length || files.length > 10)
      return { error: "Choose between 1 and 10 source files." };
    for (const file of files) {
      if (
        file.size > 25 * 1024 * 1024 ||
        !/\.(pdf|txt|md)$/i.test(file.name)
      )
        return { error: "Choose PDF or text sources up to 25 MB each." };
      // Browsers often leave the MIME type empty or use a generic value for
      // Markdown. Normalize from the extension, then let the API verify the
      // actual file contents and reject renamed binaries.
      body.append(
        "files",
        /\.[md]$/i.test(file.name)
          ? new File([file], file.name, { type: "text/markdown" })
          : file,
      );
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
  return {
    success:
      "Source upload accepted. Open the course to inspect processing and review the draft.",
    destination: `/courses/${segment(id)}`,
    selectedSubjectId: String(form.get("subject_id") || ""),
  };
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

export async function acceptCourseInvitationAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const token = text(form, "token", 200);
    if (!/^[a-f0-9]{64}$/i.test(token.trim()))
      return { error: "Paste the full invitation code from your teacher." };

    const joined = await api<{ courseId: string; role?: string }>("/api/v1/study/courses/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token: token.trim() }),
    });
    revalidatePath("/courses");
    revalidatePath("/dashboard");
    let destination = `/courses/${segment(joined.courseId)}`;
    try {
      const details = await api<{ course: { activeRevisionId?: string } }>(destination.replace("/courses/", "/api/v1/study/courses/"));
      if (details.course.activeRevisionId && joined.role !== "instructor") destination += "/learn";
    } catch (error) { unstable_rethrow(error); /* Enrollment succeeded; keep the course link if details are temporarily unavailable. */ }
    return {
      success: joined.role === "instructor" ? "Course assignment accepted." : "You joined the course. It is now in My Learning.",
      destination,
      destinationLabel: "Open my course",
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to accept the course invitation.",
    };
  }
}

export async function issueCourseInvitationAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const courseId = text(form, "courseId", 50);
    const role = "student";
    const expiresInHours = 168;

    const res = await api<{ token: string; expiresAt: string }>(
      `/api/v1/study/courses/${segment(courseId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ role, expiresInHours }),
      },
    );
    return { success: "Invitation ready. Copy the code and send it to one student.", invitation: res };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to issue course invitation.",
    };
  }
}

export async function assignInstructorAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const courseId = text(form, "courseId", 50);
    const instructorUserId = text(form, "instructorUserId", 100);

    await api(`/api/v1/study/courses/${segment(courseId)}/instructors`, {
      method: "POST",
      body: JSON.stringify({ instructorUserId }),
    });
    revalidatePath(`/courses/${segment(courseId)}`);
    return { success: "Instructor assigned to course." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to assign instructor.",
    };
  }
}

export async function withdrawEnrollmentAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const courseId = text(form, "courseId", 50);
    await api(`/api/v1/study/courses/${segment(courseId)}/enrollments`, {
      method: "DELETE",
    });
    revalidatePath("/courses");
    return { success: "You have withdrawn from this course." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to withdraw from course.",
    };
  }
}

export async function updateDraftAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const courseId = text(form, "courseId", 50);
    const expectedRevisionTag = text(form, "expectedRevisionTag", 100);
    const topicsRaw = optionalText(form, "topicsJson");
    const summary = optionalText(form, "summary");
    const isInstructorReviewed = form.get("isInstructorReviewed") === "true";
    const extractionReviewAcknowledged =
      form.get("extractionReviewAcknowledged") === "true";

    const topics = topicsRaw ? JSON.parse(topicsRaw) : [];

    await api(`/api/v1/study/courses/${segment(courseId)}/draft`, {
      method: "PUT",
      body: JSON.stringify({
        expectedRevisionTag,
        topics,
        summary,
        isInstructorReviewed,
        extractionReviewAcknowledged,
      }),
    });

    revalidatePath(`/courses/${segment(courseId)}/studio`);
    revalidatePath(`/courses/${segment(courseId)}`);
    return { success: "Course draft saved successfully." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to save course draft.",
    };
  }
}

export async function publishRevisionAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const courseId = text(form, "courseId", 50);
    const expectedRevisionTag = text(form, "expectedRevisionTag", 100);

    const publication = await api<{publishedRevisionTag:string}>(`/api/v1/study/courses/${segment(courseId)}/publish`, {
      method: "POST",
      body: JSON.stringify({ expectedRevisionTag }),
    });

    revalidatePath(`/courses/${segment(courseId)}/studio`);
    revalidatePath(`/courses/${segment(courseId)}`);
    return { success: "Course revision published successfully.", publishedRevisionTag: publication.publishedRevisionTag };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to publish course revision.",
    };
  }
}

export async function generateCandidateActivity(
  courseId: string,
  objectiveId: string,
  activityType: "InteractiveQuiz" | "GuidedProblem",
  title?: string,
  instructions?: string,
  expectedRevisionTag?: string,
  sourceChunkId?: string,
  settings?: {
    language: "en" | "fr" | "ar" | "ary";
    difficulty: "beginner" | "standard" | "advanced";
    hintDepth: "none" | "cue" | "context";
    sourceSectionId?: string;
  },
) {
  await requireIdentity();
  return api<{
    candidateActivity: Record<string, unknown>;
    candidateEvaluation: Record<string, unknown>;
    draftRevisionTag: string;
    generatedAt: string;
  }>(`/api/v1/study/courses/${segment(courseId)}/studio/generate-activity`, {
    method: "POST",
    body: JSON.stringify({
      objectiveId,
      activityType,
      title,
      instructions,
      expectedRevisionTag,
      sourceChunkId,
      ...settings,
    }),
  });
}

export async function registerCandidateActivity(
  courseId: string,
  activityId: string,
  activity: Record<string, unknown>,
  serverEvaluation: Record<string, unknown>,
) {
  await requireIdentity();
  return api<{
    activityId: string;
    revisionId: string;
  }>(`/api/v1/study/activities/${segment(activityId)}/register`, {
    method: "POST",
    body: JSON.stringify({
      courseId,
      activity,
      serverEvaluation,
    }),
  });
}
