import { notFound } from "next/navigation";
import { LessonReader } from "@/features/reader/lesson-reader";
import { previewPresentation, previewAssets } from "@/features/reader/preview-fixture";
import { isReaderMode, type ReaderMode } from "@noveris/shared/ednova/presentationPlan";

/**
 * Development-only reader preview. It renders the real `LessonReader` from a
 * real `PublishedPresentationV1` built by the production builder, so the
 * learner surface can be exercised in a browser without a live database.
 *
 * It is unreachable in a production build: the guard runs before any render.
 */
export const dynamic = "force-dynamic";

export default async function ReaderPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string; mode?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { lesson, mode } = await searchParams;
  const lessons = previewPresentation.chapters.flatMap((chapter) => chapter.lessons);
  const selected = lessons.find((entry) => entry.id === lesson)?.id ?? lessons[0]?.id ?? "";
  const readerMode: ReaderMode = isReaderMode(mode) ? mode : "read";
  return (
    <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6">
      <p
        role="status"
        className="mb-4 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs leading-5"
      >
        Development preview · rendered from a real published-presentation contract, not live
        course data. Unavailable in a production build.
      </p>
      <LessonReader
        presentation={{ ...previewPresentation, assets: previewAssets }}
        lessonId={selected}
        initialMode={readerMode}
        practiceHref="/practice"
        fallbackHref="/reader-preview"
        basePath="/reader-preview"
      />
    </div>
  );
}
