import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { CourseList } from "@/features/courses/course-list";
import { getCourses, getSubjects } from "@/features/courses/queries";
export const metadata = { title: "Courses" };
export default async function Courses({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const [courses, subjects, query] = await Promise.all([
    getCourses(),
    getSubjects(),
    searchParams,
  ]);
  const visible = (courses.data?.courses || []).filter(
    (c) =>
      (!query.q || c.title.toLowerCase().includes(query.q.toLowerCase())) &&
      (!query.status || c.status === query.status),
  );
  return (
    <>
      <PageHeader
        title="Your courses"
        description="A little progress, every day."
        action={
          <Button asChild>
            <Link href="/courses/new">
              <Upload data-icon="inline-start" />
              Upload course
            </Link>
          </Button>
        }
      />
      <DataError message={courses.error || subjects.error} />
      <nav
        aria-label="Course filters"
        className="mb-6 flex gap-7 border-b pb-4 text-sm"
      >
        <Link href="/courses" className="font-medium text-primary">
          All courses
        </Link>
        <Link
          href="/courses?status=processing"
          className="text-muted-foreground"
        >
          Processing
        </Link>
        <Link
          href="/courses?status=completed"
          className="text-muted-foreground"
        >
          Ready to study
        </Link>
      </nav>
      <CourseList courses={visible} subjects={subjects.data?.subjects || []} />
    </>
  );
}
