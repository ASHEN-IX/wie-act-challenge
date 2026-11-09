import { Compass } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { getPublicCourses } from "@/features/courses/queries";
import {
  joinPublicCourseAction,
  leavePublicCourseAction,
} from "@/features/courses/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Explore courses" };

export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const result = await getPublicCourses(q?.slice(0, 80));
  const courses = result.data?.courses || [];

  return (
    <>
      <PageHeader
        title="Explore courses"
        description="Courses their authors made open to everyone. Add one to My Learning to start."
      />
      <form
        action="/explore"
        className="mb-6 flex max-w-xl gap-2"
        role="search"
      >
        <input
          name="q"
          defaultValue={q}
          aria-label="Search public courses"
          placeholder="Search by title or topic…"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <DataError message={result.error} />
      {!result.error && courses.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Compass className="size-4" />
          {q
            ? "No public course matches your search."
            : "No public courses yet. Authors can make a published course public from its Studio page."}
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <li
            key={course.id}
            className="flex flex-col rounded-lg border bg-card p-5"
          >
            <h2 className="font-semibold">{course.title}</h2>
            {course.institutionName && (
              <p className="text-xs text-muted-foreground">
                {course.institutionName}
              </p>
            )}
            <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
              {course.description || "No description yet."}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {course.topicsCount} chapter{course.topicsCount === 1 ? "" : "s"}
            </p>
            <div className="mt-3">
              {course.own ? (
                <Link
                  className="text-sm underline"
                  href={`/courses/${course.id}`}
                >
                  Your course · open
                </Link>
              ) : course.joined ? (
                <div className="flex items-center gap-4">
                  <Link
                    className="text-sm underline"
                    href={`/courses/${course.id}`}
                  >
                    Open course
                  </Link>
                  <ActionForm
                    action={leavePublicCourseAction}
                    submit="Remove"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="courseId" value={course.id} />
                  </ActionForm>
                </div>
              ) : (
                <ActionForm
                  action={joinPublicCourseAction}
                  submit="Add to My Learning"
                  className="flex flex-col gap-2"
                >
                  <input type="hidden" name="courseId" value={course.id} />
                </ActionForm>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
