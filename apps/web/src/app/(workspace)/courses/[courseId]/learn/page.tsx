import { requireIdentity } from "@/server/identity";
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
        <CourseReader document={document} practiceHref="#practice-and-tutor" />
        <section id="practice-and-tutor" className="mt-14 scroll-mt-20 border-t pt-10">
          <div className="mb-6 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Apply what you read</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Practice and tutor</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a reviewed activity, check your understanding, or ask a question grounded in this exact revision.</p>
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
