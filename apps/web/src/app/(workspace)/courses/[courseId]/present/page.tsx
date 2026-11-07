import {
  learningDocument,
  lessonRecommendation,
  plannedLessonExperience,
  publishedPresentation,
  storedLessonPlan,
} from "@/features/learning/journey-actions";
import { LessonReader } from "@/features/reader/lesson-reader";
import { CourseReader } from "@/features/reader/course-reader";
import { DataError } from "@/components/shared/states";
import { isReaderMode, type ReaderMode } from "@ednova/shared/ednova/presentationPlan";
import { isLearningMode } from "@ednova/shared/ednova/learningModes";

/**
 * Published-course lesson reader. The presentation contract is preferred; if
 * it is unavailable or fails its strict parse, the deterministic
 * source-faithful reader renders the same authorized revision instead.
 *
 * Lesson selection and reader mode live in the URL so a lesson is
 * deep-linkable and browser history works.
 */
export default async function PresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{
    revisionId?: string;
    lesson?: string;
    mode?: string;
    plan?: string;
  }>;
}) {
  const { courseId } = await params;
  const { revisionId, lesson, mode, plan } = await searchParams;
  try {
    const presentation = await publishedPresentation(courseId, revisionId);
    const lessons = presentation.chapters.flatMap((chapter) => chapter.lessons);
    const selected =
      lessons.find((entry) => entry.id === lesson)?.id ?? lessons[0]?.id ?? "";
    // `mode` carries either a Batch 3 reader mode or a Batch 4.3 learning mode.
    // A learning mode wins when it is one; otherwise the legacy mapping applies.
    const learningMode = isLearningMode(mode) ? mode : undefined;
    const readerMode: ReaderMode = isReaderMode(mode) ? mode : "read";

    // Development/QA pathway: `?plan=<scenario>` asks the API for a mock-planned
    // layout. Any failure — disabled, rejected, unavailable, unparseable — yields
    // undefined and the deterministic presentation renders exactly as before.
    const selectedLesson = lessons.find((entry) => entry.id === selected);
    const experiencePlan =
      plan && selectedLesson
        ? await plannedLessonExperience(
            courseId,
            selected,
            plan,
            selectedLesson.blocks.map((entry) => entry.id),
          )
        : undefined;

    // M4.3: a mode plan is fetched on the server for the selected mode. Read
    // never requests one. A missing or stale plan yields undefined, and the
    // reader falls back with a visible explanation.
    const modePlan =
      learningMode && learningMode !== "read" && selectedLesson
        ? await storedLessonPlan(
            courseId,
            selected,
            learningMode,
            selectedLesson.blocks.map((entry) => entry.id),
          )
        : undefined;
    const effectivePlan = modePlan ?? experiencePlan;

    // M4.4: an optional, explained suggestion. Any failure yields undefined and
    // the reader simply shows no suggestion — adaptation never blocks a lesson.
    const suggestion = selected
      ? await lessonRecommendation(courseId, selected, learningMode ?? "read")
      : undefined;

    return (
      <LessonReader
        presentation={presentation}
        lessonId={selected}
        practiceHref={`/courses/${courseId}/learn?revisionId=${encodeURIComponent(presentation.revisionId)}#practice-and-tutor`}
        fallbackHref={presentation.fallback.readerHref}
        initialMode={readerMode}
        {...(learningMode ? { initialLearningMode: learningMode } : {})}
        {...(effectivePlan ? { experiencePlan: effectivePlan } : {})}
        {...(suggestion ? { recommendation: suggestion } : {})}
        dismissSuggestionHref={`/api/v1/study/learning/courses/${encodeURIComponent(courseId)}/adaptation/dismiss`}
      />
    );
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
          <CourseReader document={document} practiceHref={`/courses/${courseId}/learn?revisionId=${encodeURIComponent(document.revisionId)}#practice-and-tutor`} />
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
