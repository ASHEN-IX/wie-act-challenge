import { learningDocument, publishedPresentation } from "@/features/learning/journey-actions";
import { PresentationView } from "@/features/reader/presentation-view";
import { CourseReader } from "@/features/reader/course-reader";
import { DataError } from "@/components/shared/states";

/**
 * Published-course presentation route. The presentation contract is preferred;
 * if it is unavailable or fails its strict parse, the deterministic
 * source-faithful reader renders the same authorized revision instead.
 */
export default async function PresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ revisionId?: string }>;
}) {
  const { courseId } = await params;
  const { revisionId } = await searchParams;
  try {
    const presentation = await publishedPresentation(courseId, revisionId);
    return <PresentationView presentation={presentation} />;
  } catch (error) {
    // Server-side diagnostic only; learners see the deterministic fallback, not
    // internal error text.
    console.error("[presentation] projection failed", error);
    try {
      const document = await learningDocument(courseId, revisionId);
      return (
        <div className="mx-auto max-w-6xl">
          <p
            role="status"
            className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6"
          >
            The presentation projection is unavailable for this revision. Showing the
            deterministic source-faithful reader of the same authorized revision.
          </p>
          <CourseReader document={document} practiceHref="#practice-and-tutor" />
        </div>
      );
    } catch (error) {
      return (
        <DataError
          message={
            error instanceof Error ? error.message : "Published learning is unavailable."
          }
        />
      );
    }
  }
}
