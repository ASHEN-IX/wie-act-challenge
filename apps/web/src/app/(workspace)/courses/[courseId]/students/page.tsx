import Link from "next/link";
import { getCourse, getCourseEnrollments } from "@/features/courses/queries";
import { CourseSharing } from "@/features/courses/course-sharing";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default async function CourseStudents({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const result = await getCourse(courseId);
  const course = result.data?.course;
  if (!course) return <DataError message={result.error || "Course not found."} />;
  if (course.scope !== "institutional") return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">This course is private</h1>
      <p>To teach a class, upload a course and choose “Students at” your institution. Private study material cannot accept student enrollments.</p>
      <Button asChild><Link href="/courses/new">Upload a class course</Link></Button>
    </section>
  );
  // The API checks the caller's course-specific right to manage enrollments.
  const enrollments = await getCourseEnrollments(courseId);
  if (!enrollments.data) return <DataError message={enrollments.error || "You cannot manage students for this course."} />;
  const active = enrollments.data.enrollments.filter((item) => item.status === "active");
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Invite students" description={course.title} action={<Button asChild variant="outline"><Link href={`/courses/${courseId}/studio`}>Back to course</Link></Button>} />
      {course.activeRevisionId ? (
        <>
          <p className="text-sm">Your course is published. Students can join with an invitation and start learning.</p>
          <section aria-label="Student invitation"><CourseSharing courseId={courseId} /></section>
        </>
      ) : (
        <section className="space-y-3 rounded-lg border p-5">
          <h2 className="font-semibold">Publish your course first</h2>
          <p className="text-sm text-muted-foreground">Review the lessons and publish them before inviting students.</p>
          <Button asChild><Link href={`/courses/${courseId}/studio`}>Review and publish course</Link></Button>
        </section>
      )}
      <section className="border-t pt-6">
        <h2 className="text-lg font-semibold">Enrolled students</h2>
        <p className="mt-2 text-sm">{active.length} {active.length === 1 ? "student has" : "students have"} joined this course.</p>
        <p className="mt-1 text-sm text-muted-foreground">Refresh this page after a student joins to update the count. Students who are not institution members must contact their administrator first.</p>
      </section>
    </div>
  );
}
