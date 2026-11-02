import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { TextField } from "@/components/shared/form-field";
import { getCourse } from "@/features/courses/queries";
import { deleteCourse } from "@/features/courses/actions";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const result = await getCourse(courseId);
  const course = result.data?.course;
  if (!course)
    return <DataError message={result.error || "Course not found."} />;
  return (
    <>
      <PageHeader
        title={course.title}
        description={
          course.description || "Your source material and extracted topics."
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/courses/${course.id}/studio`}>Course Studio</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/courses/${course.id}/learn`}>
                Open published learning
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/visual-lab?courseId=${course.id}`}>
                Explore visually
              </Link>
            </Button>
          </div>
        }
      />
      <Badge variant="secondary">{course.status}</Badge>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex flex-col gap-7">
          <h2 className="text-xl font-semibold">Course outline</h2>
          {course.topics?.length ? (
            course.topics.map((topic, i) => (
              <article key={topic.id || i} className="border-b pb-6">
                <h3 className="text-lg font-medium">
                  {i + 1}. {topic.title}
                </h3>
                {topic.summary && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {topic.summary}
                  </p>
                )}
                {topic.subtopics?.map((sub, j) => (
                  <div key={sub.id || j} className="mt-4 border-l-2 pl-4">
                    <h4 className="font-medium">{sub.title}</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {sub.summary}
                    </p>
                  </div>
                ))}
              </article>
            ))
          ) : (
            <EmptyState
              title="No extracted topics yet"
              description={
                course.status === "processing"
                  ? "Processing is queued. Refresh this page after the ingestion worker finishes."
                  : "Your source files are available below. Processing may need to be retried by the course owner."
              }
            />
          )}
        </section>
        <aside className="flex flex-col gap-6">
          <h2 className="font-semibold">Original sources</h2>
          {course.files?.map((file) => (
            <a
              key={file.filename}
              href={`/api/v1/study/courses/${course.id}/files/${encodeURIComponent(file.filename)}`}
              className="break-words rounded-lg border p-4 text-sm hover:bg-muted"
            >
              {file.originalName || file.filename}
            </a>
          ))}
          <details className="mt-8 border-t pt-5">
            <summary className="cursor-pointer text-sm text-destructive">
              Delete course
            </summary>
            <div className="mt-4">
              <ActionForm
                action={deleteCourse}
                submit="Delete permanently"
                variant="destructive"
              >
                <input type="hidden" name="id" value={course.id} />
                <TextField
                  label="Type DELETE to confirm"
                  name="confirmation"
                  required
                  pattern="DELETE"
                />
              </ActionForm>
            </div>
          </details>
        </aside>
      </div>
    </>
  );
}
