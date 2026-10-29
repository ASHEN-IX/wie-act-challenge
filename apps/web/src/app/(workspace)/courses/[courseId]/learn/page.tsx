import { requireIdentity } from "@/server/identity";
import {
  learningCatalog,
  loadWorkspaceLanguage,
} from "@/features/learning/journey-actions";
import { LearningWorkspace } from "@/features/learning/learning-workspace";
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
    const [catalog, language] = await Promise.all([
      learningCatalog(courseId, revisionId),
      // A failed preference read must not block the lesson; English is the
      // documented fallback.
      loadWorkspaceLanguage().catch(() => "en" as const),
    ]);
    return (
      <LearningWorkspace
        catalog={catalog}
        userId={identity.userId}
        initialLanguage={language}
      />
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
