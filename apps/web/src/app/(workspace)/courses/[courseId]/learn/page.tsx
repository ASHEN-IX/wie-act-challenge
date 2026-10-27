import { requireIdentity } from "@/server/identity";
import { learningCatalog } from "@/features/learning/journey-actions";
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
    const catalog = await learningCatalog(courseId, revisionId);
    return <LearningWorkspace catalog={catalog} userId={identity.userId} />;
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
