import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireIdentity } from "@/server/identity";
import { getCourse, getCourseDraft } from "@/features/courses/queries";
import { ActionForm } from "@/components/shared/action-form";
import { TextField } from "@/components/shared/form-field";
import { deleteCourse } from "@/features/courses/actions";
import { CourseStudio } from "@/features/courses/course-studio";
import { DataError } from "@/components/shared/states";

export default async function CourseStudioPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const identity = await requireIdentity();
  const { courseId } = await params;

  const [courseRes, draftRes] = await Promise.all([
    getCourse(courseId),
    getCourseDraft(courseId),
  ]);

  const course = courseRes.data?.course;
  const draft = draftRes.data?.draft;

  if (!course) {
    return <DataError message={courseRes.error || "Course not found."} />;
  }

  if (!draft) {
    return (
      <DataError
        message={
          draftRes.error ||
          "Unable to load course draft. Studio access is restricted to course instructors and administrators."
        }
      />
    );
  }

  return (
    <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <p className="text-sm">{course.activeRevisionId ? "Published. Invite students to start learning." : "Review and publish your course, then invite students."}</p>
      <Button asChild variant="outline"><Link href={`/courses/${course.id}/students`}>Invite students</Link></Button>
    </div>
    <CourseStudio
      courseId={course.id}
      courseTitle={course.title}
      initialDraft={draft}
      originalFiles={course.files}
      currentUserId={identity.userId}
      hasPublishedRevision={Boolean(course.activeRevisionId)}
    />
    <details className="mt-8 border-t pt-5">
      <summary className="cursor-pointer text-sm text-destructive">Delete course</summary>
      <div className="mt-4 max-w-md">
        <ActionForm action={deleteCourse} submit="Delete permanently" variant="destructive">
          <input type="hidden" name="id" value={course.id} />
          <TextField label="Type DELETE to confirm" name="confirmation" required pattern="DELETE" />
        </ActionForm>
      </div>
    </details>
    </>
  );
}

