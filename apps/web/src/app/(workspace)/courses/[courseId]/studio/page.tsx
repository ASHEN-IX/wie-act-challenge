import { requireIdentity } from "@/server/identity";
import { getCourse, getCourseDraft } from "@/features/courses/queries";
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
    <CourseStudio
      courseId={course.id}
      courseTitle={course.title}
      initialDraft={draft}
      currentUserId={identity.userId}
    />
  );
}

