import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { LabWorkspace } from "@/features/visual-lab/lab-workspace";
import { loadLab } from "@/features/visual-lab/actions";
import { getCourse } from "@/features/courses/queries";

export const metadata = { title: "Visual Learning Lab" };

export default async function VisualLabPage({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const { labId } = await params;
  try {
    const lab = await loadLab(labId);
    const courseId =
      lab.sourceContext.mode === "course"
        ? lab.sourceContext.courseId
        : undefined;
    // The course is context only: if it cannot be read the lab still works.
    const course = courseId ? (await getCourse(courseId)).data?.course : undefined;
    const labRevision = lab.sourceContext.revisionId;
    const learnHref = courseId ? `/courses/${courseId}/learn${labRevision ? `?revisionId=${encodeURIComponent(labRevision)}` : ""}` : undefined;
    const olderRevision =
      course?.activeRevisionId &&
      lab.sourceContext.revisionId &&
      course.activeRevisionId !== lab.sourceContext.revisionId;
    return (
      <>
        <nav aria-label="Where you came from" className="mb-4 text-sm">
          <Link
            href={learnHref ? `${learnHref}#explore-visually` : "/visual-lab"}
            className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {learnHref
              ? `Back to ${course?.title ?? "the course"}`
              : "Back to Visual Lab"}
          </Link>
        </nav>
        <PageHeader
          title={lab.title}
          description="Change the inputs, watch the computed result, then explain it in your own words."
        />
        {olderRevision && (
          <p
            role="note"
            className="mb-6 max-w-2xl rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          >
            This lab was built from an earlier published revision of the
            course. The lesson may have changed since; the experiment itself
            is unchanged.
          </p>
        )}
        <LabWorkspace lab={lab} />
        <section
          aria-labelledby="lab-next"
          className="mt-12 max-w-3xl border-t pt-8"
        >
          <h2 id="lab-next" className="text-lg font-semibold">
            Next step
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This experiment and its check are practice only. They do not count
            as mastery or add progress. Graded practice is in the course.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
            {learnHref ? (
              <>
                <Link
                  href={`${learnHref}#practice-and-tutor`}
                  className="rounded-lg border bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
                >
                  Practice this in the course
                </Link>
                <Link href={learnHref} className="rounded-lg border px-4 py-2 hover:bg-muted/50">
                  Back to the lesson
                </Link>
                <Link
                  href={`/study-together?courseId=${courseId}${labRevision ? `&revisionId=${encodeURIComponent(labRevision)}` : ""}`}
                  className="rounded-lg border px-4 py-2 hover:bg-muted/50"
                >
                  Explain it with peers
                </Link>
              </>
            ) : (
              <>
                <Link href="/courses" className="rounded-lg border px-4 py-2 hover:bg-muted/50">
                  Find a course on this topic
                </Link>
                <Link href="/visual-lab" className="rounded-lg border px-4 py-2 hover:bg-muted/50">
                  Try another experiment
                </Link>
              </>
            )}
          </div>
        </section>
      </>
    );
  } catch (error) {
    return (
      <DataError
        message={
          error instanceof Error
            ? error.message
            : "This visual lab is unavailable."
        }
      />
    );
  }
}
