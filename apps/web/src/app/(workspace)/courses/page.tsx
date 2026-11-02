import Link from "next/link";
import { Upload, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { CourseList } from "@/features/courses/course-list";
import { getCourses, getSubjects } from "@/features/courses/queries";
import { getInstitutionContexts } from "@/features/institutions/queries";
import { ActionForm } from "@/components/shared/action-form";
import { TextField } from "@/components/shared/form-field";
import { acceptCourseInvitationAction } from "@/features/courses/actions";
import { isCourseReady } from "@/features/courses/lifecycle";

export const metadata = { title: "Courses" };

export default async function Courses({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    institution_id?: string;
  }>;
}) {
  const query = await searchParams;
  const [courses, subjects, instContexts] = await Promise.all([
    getCourses(query.institution_id),
    getSubjects(),
    getInstitutionContexts(),
  ]);

  const visible = (courses.data?.courses || []).filter(
    (c) =>
      (!query.q || c.title.toLowerCase().includes(query.q.toLowerCase())) &&
      (!query.status ||
        (query.status === "ready"
          ? isCourseReady(c)
          : c.status === query.status)),
  );

  const institutions = instContexts.data?.institutions || [];

  return (
    <>
      <PageHeader
        title="Your courses"
        description="A little progress, every day."
        action={
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/courses/new">
                <Upload data-icon="inline-start" />
                Upload course
              </Link>
            </Button>
          </div>
        }
      />
      <DataError message={courses.error || subjects.error} />

      {/* Institutional Context Switcher */}
      {institutions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b pb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">
            Context:
          </span>
          <Link
            href="/courses"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !query.institution_id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All authorized courses
          </Link>
          {institutions.map((ctx) => (
            <Link
              key={ctx.institution.id}
              href={`/courses?institution_id=${ctx.institution.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                query.institution_id === ctx.institution.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {ctx.institution.name} ({ctx.membership.role})
            </Link>
          ))}
        </div>
      )}

      {/* Course Enrollment Capability */}
      <details className="mb-6 rounded-lg border bg-card p-4 text-card-foreground">
        <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
          <Key className="h-4 w-4" />
          Enroll in a course with an invite code
        </summary>
        <div className="mt-3 max-w-md">
          <ActionForm action={acceptCourseInvitationAction} submit="Enroll now">
            <TextField
              label="Course Invitation Token"
              name="token"
              placeholder="Paste the course invite token..."
              required
            />
          </ActionForm>
        </div>
      </details>

      <nav
        aria-label="Course filters"
        className="mb-6 flex gap-7 border-b pb-4 text-sm"
      >
        <Link
          href={
            query.institution_id
              ? `/courses?institution_id=${query.institution_id}`
              : "/courses"
          }
          className="font-medium text-primary"
        >
          All courses
        </Link>
        <Link
          href={
            query.institution_id
              ? `/courses?institution_id=${query.institution_id}&status=processing`
              : "/courses?status=processing"
          }
          className="text-muted-foreground"
        >
          Processing
        </Link>
        <Link
          href={
            query.institution_id
              ? `/courses?institution_id=${query.institution_id}&status=ready`
              : "/courses?status=ready"
          }
          className="text-muted-foreground"
        >
          Ready to study
        </Link>
      </nav>

      <CourseList courses={visible} subjects={subjects.data?.subjects || []} />
    </>
  );
}
