import { load } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { RewardSummary } from "@/features/rewards/reward-summary";
import type { LearningRewards } from "@/features/rewards/types";
interface Competency {
  subjectId: string;
  subjectName: string;
  topics: {
    topicId: string;
    topicName: string;
    levels: {
      bloomLevel: string;
      score: number;
      confidence: number;
      count: number;
    }[];
  }[];
}
export const metadata = { title: "Progress" };
export default async function Progress() {
  const [competency, rewards] = await Promise.all([
    load<{ competencies: Competency[] }>("/api/v1/competencies"),
    load<LearningRewards>("/api/v1/users/learning-rewards"),
  ]);
  return (
    <>
      <PageHeader
        title="Progress, with perspective"
        description="Review your learning evidence. XP reflects activity, not mastery."
      />
      <DataError message={competency.error || rewards.error} />
      {rewards.data && <RewardSummary rewards={rewards.data} />}
      {competency.data?.competencies.length ? (
        competency.data.competencies.map((subject) => (
          <section key={subject.subjectId} className="mb-8">
            <h2 className="mb-5 text-xl font-semibold">
              {subject.subjectName || "Course competencies"}
            </h2>
            {subject.topics.map((topic) => (
              <article
                key={topic.topicId}
                className="mb-4 rounded-lg border p-5"
              >
                <h3 className="mb-4 font-medium">{topic.topicName}</h3>
                <div className="flex flex-wrap gap-3">
                  {topic.levels.map((level) => (
                    <Badge variant="secondary" key={level.bloomLevel}>
                      {level.bloomLevel}: {Math.round(level.score * 100)}% ·{" "}
                      {level.count} observations
                    </Badge>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ))
      ) : (
        <EmptyState
          title="Evidence takes practice"
          description="Complete evaluated practice to start building a picture of your understanding."
        />
      )}
    </>
  );
}
