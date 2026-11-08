import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { getCourses } from "@/features/courses/queries";
import { LabLibrary } from "@/features/visual-lab/lab-library";
import { LabStarter } from "@/features/visual-lab/lab-starter";
import { discoverConcepts, getMyLabs } from "@/features/visual-lab/queries";

export const metadata = { title: "Visual Lab" };

export default async function VisualLabIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId: requested } = await searchParams;
  const [courses, mine] = await Promise.all([getCourses(), getMyLabs()]);
  if (!courses.data)
    return (
      <DataError message={courses.error || "Your courses are unavailable."} />
    );
  const list = courses.data.courses;
  const selected = list.find((c) => c.id === requested) ?? list[0];

  // Discovery reads the pinned course revision; an unpublished course is a
  // normal state, not an error to shout about.
  const found = selected ? await discoverConcepts(selected.id) : undefined;

  return (
    <>
      <PageHeader
        title="Visual Lab"
        description="Pick a concept, change the experiment, then check what you understood. All numbers are computed by the app, not the AI. Labs are practice only and never count as mastery."
      />
      <p className="-mt-4 mb-8 text-sm text-muted-foreground">
        Studying a course? Open its lesson to explore the concepts from that
        course in place. Another example:{" "}
        <Link
          href="/visualizer"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          binary search, step by step
        </Link>
        .
      </p>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <LabStarter
          courses={list.map((c) => ({ id: c.id, title: c.title }))}
          courseId={selected?.id}
          suggestions={found?.data?.concepts ?? []}
          discoveryNote={
            found?.error
              ? "This course has no published material to scan yet."
              : found?.data && !found.data.concepts.length
                ? `Scanned ${found.data.sectionsScanned} section${found.data.sectionsScanned === 1 ? "" : "s"}: none matches a concept the lab can show yet. Describe one below.`
                : undefined
          }
        />
        <aside aria-labelledby="my-labs" className="flex flex-col gap-3">
          <h2 id="my-labs" className="text-lg font-semibold">
            Your labs
          </h2>
          {mine.data ? (
            <LabLibrary
              labs={mine.data.labs}
              courseTitles={Object.fromEntries(
                list.map((c) => [c.id, c.title]),
              )}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Your labs are unavailable right now.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
