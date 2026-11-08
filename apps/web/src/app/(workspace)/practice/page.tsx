import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getCourses } from "@/features/courses/queries";
import { isCourseReady } from "@/features/courses/lifecycle";

export const metadata = { title: "Practice" };

/**
 * Practice is course-grounded: feedback is checked against a published revision
 * and the result becomes learner evidence. This legacy URL therefore forwards to
 * the course's practice section instead of offering an ungrounded free-text box.
 */
export default async function Practice({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId: requested } = await searchParams;
  const courses = await getCourses();
  const ready = (courses.data?.courses ?? []).filter(isCourseReady);
  const target = requested ? ready.find((course) => course.id === requested) : ready.length === 1 ? ready[0] : undefined;
  if (target) redirect(`/courses/${target.id}/learn#practice-and-tutor`);
  return (
    <>
      <PageHeader
        title="Practice"
        description="Practice happens inside a course, so feedback is checked against its published material."
      />
      <DataError message={courses.error} />
      {!courses.error && (
        <EmptyState
          title={requested ? "Course unavailable" : ready.length ? "Choose a course to practice" : "No course to practice yet"}
          description={requested ? "This course is unavailable or not ready for practice. Choose an available course." : ready.length ? "Open a course to practice its published material." : "Join a teacher's course, or wait until one is published, then practice from its learning page."}
        >
          <Button asChild size="sm">
            <Link href="/courses">Go to your courses</Link>
          </Button>
        </EmptyState>
      )}
    </>
  );
}
