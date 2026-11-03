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
    const [catalog, document, language] = await Promise.all([
      learningCatalog(courseId, revisionId),
      learningDocument(courseId, revisionId),
      // A failed preference read must not block the lesson; English is the
      // documented fallback.
      loadWorkspaceLanguage().catch(() => "en" as const),
    ]);
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/25 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Read your course, then practice what you learned.
          </span>
          <Link
            href={`/courses/${courseId}/present${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ""}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Presentation view
          </Link>
        </div>
        <CourseReader document={document} practiceHref="#practice-and-tutor" />
        <section id="practice-and-tutor" className="mt-14 scroll-mt-20 border-t pt-10">
          <div className="mb-6 max-w-2xl">
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Practice and feedback</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Practice the lesson and get private feedback. Ask the tutor when you need help.</p>
          </div>
          <LearningWorkspace
            catalog={catalog}
            userId={identity.userId}
            initialLanguage={language}
          />
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
