import Link from "next/link";
import { hasTeachingAccess } from "@/server/teaching";
import { Upload } from "lucide-react";
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
  const teaching = await hasTeachingAccess();
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
        description={
          teaching
            ? "Upload, review and publish your course material."
            : "Join a teacher’s course, then open it here to start learning."
        }
        action={
          <div className="flex gap-2">
            {!teaching && <Button asChild><a href="#join-course">Join a course</a></Button>}
            <Button asChild variant={teaching ? "default" : "outline"}>
              <Link href="/courses/new">
                <Upload data-icon="inline-start" />
                {teaching ? "Upload course" : "Add my own material"}
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
            Institution:
          </span>
          <Link
            href="/courses"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !query.institution_id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All my courses
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
              {ctx.institution.name}
            </Link>
          ))}
        </div>
      )}

      {/* Course Enrollment Capability */}
      {!teaching && (
        <section id="join-course" aria-labelledby="join-course-title" className="mb-8 scroll-mt-24 rounded-lg border bg-card p-5">
          <h2 id="join-course-title" className="text-lg font-semibold">Join your teacher’s course</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">Ask your teacher for an invitation code. You must already be a member of their institution.</p>
          <div className="max-w-xl">
            <ActionForm action={acceptCourseInvitationAction} submit="Join course">
              <TextField label="Course invitation code" name="token" placeholder="Paste the code from your teacher" required />
            </ActionForm>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Each code is for one student. If it has expired or was used, ask your teacher for a new one. For institution access, contact your institution administrator.</p>
        </section>
      )}

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

      <CourseList
        teaching={teaching}
        courses={visible}
        subjects={subjects.data?.subjects || []}
      />
    </>
  );
}
