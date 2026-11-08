import { requireIdentity } from "@/server/identity";
import Link from "next/link";
import {
  learningCatalog,
  learningDocument,
  loadWorkspaceLanguage,
} from "@/features/learning/journey-actions";
import { LearningWorkspace } from "@/features/learning/learning-workspace";
import { CourseReader } from "@/features/reader/course-reader";
import { DataError } from "@/components/shared/states";
import { CourseJourney } from "@/features/learning/course-journey";
import { SuggestionRow } from "@/features/visual-lab/lab-starter";
import { discoverConcepts } from "@/features/visual-lab/queries";
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ revisionId?: string }>;
}) {
  const identity = await requireIdentity();
  const { courseId } = await params;
  const { revisionId } = await searchParams;
  try {
    const [catalog, document, language, visual] = await Promise.all([
      learningCatalog(courseId, revisionId),
      learningDocument(courseId, revisionId),
      // A failed preference read must not block the lesson; English is the
      // documented fallback.
      loadWorkspaceLanguage().catch(() => "en" as const),
      // Discovery is optional enrichment: an error simply hides the visual step.
      discoverConcepts(courseId, revisionId),
    ]);
    const concepts = visual.data?.concepts ?? [];
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 space-y-3">
          <CourseJourney
            courseId={courseId}
            visualConcepts={concepts.length}
            revisionId={document.revisionId}
            current="Read"
          />
          <p className="text-right text-sm">
            <Link
              href={`/courses/${courseId}/present${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ""}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Presentation view
            </Link>
          </p>
        </div>
        <CourseReader document={document} practiceHref="#practice-and-tutor" />
        {concepts.length > 0 && (
          <section
            id="explore-visually"
            aria-labelledby="explore-visually-title"
            className="mt-14 scroll-mt-20 border-t pt-10"
          >
            <div className="mb-5 max-w-2xl">
              <h2
                id="explore-visually-title"
                className="font-heading text-2xl font-semibold tracking-tight"
              >
                Explore visually
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Parts of this lesson you can try as an experiment. Visual Lab
                checks are practice only: they do not change your progress.
                You return here when you are done.
              </p>
            </div>
            <ul className="flex max-w-3xl flex-col divide-y rounded-xl border">
              {concepts.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.sectionId}
                  courseId={courseId}
                  revisionId={visual.data?.revisionId}
                  suggestion={suggestion}
                />
              ))}
            </ul>
          </section>
        )}
        <section id="practice-and-tutor" className="mt-14 scroll-mt-20 border-t pt-10">
          <div className="mb-6 max-w-2xl">
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Practice and feedback</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Practice the lesson and get private feedback. Ask the tutor when you need help.</p>
          </div>
          <LearningWorkspace
            catalog={catalog}
            userId={identity.userId}
            initialLanguage={language}
            visualConcepts={concepts.length}
          />
        </section>
        <section
          aria-labelledby="after-practice"
          className="mt-14 border-t pt-10"
        >
          <h2
            id="after-practice"
            className="font-heading text-2xl font-semibold tracking-tight"
          >
            What next
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Explain this lesson to a classmate, or review the evidence your
            accepted practice has produced.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
            <Link
              href={`/study-together?courseId=${courseId}&revisionId=${encodeURIComponent(document.revisionId)}`}
              className="rounded-lg border px-4 py-2 hover:bg-muted/50"
            >
              Study this course with peers
            </Link>
            <Link href="/progress" className="rounded-lg border px-4 py-2 hover:bg-muted/50">
              Review your progress
            </Link>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    return (
      <DataError
        message={
          error instanceof Error
            ? error.message
            : "Published learning is unavailable."
        }
      />
    );
  }
}
