import Link from "next/link";
import { load } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RewardSummary } from "@/features/rewards/reward-summary";
import type { LearningRewards } from "@/features/rewards/types";
interface Competency {
  subjectId: string;
  subjectName: string;
  topics: {
    topicId: string;
    topicName: string;
    parentTopic?: string;
    courseId?: string;
    levels: {
      bloomLevel: string;
      score: number;
      confidence: number;
      count: number;
      needsReview?: boolean;
    }[];
  }[];
}
// Bloom levels are reported in their canonical order; label them for a learner
// rather than showing the taxonomy constant.
const LEVEL_LABELS: Record<string, string> = {
  REMEMBER: "Recall",
  UNDERSTAND: "Understand",
  APPLY: "Apply",
  ANALYSE: "Analyse",
  EVALUATE: "Evaluate",
  CREATE: "Create",
};
function levelLabel(level: string) {
  return LEVEL_LABELS[level] ?? level;
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
        title="Progress"
        description="Your verified learning evidence. XP counts activity, not mastery."
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
                <h3 className="font-medium">{topic.topicName}</h3>
                {topic.parentTopic && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {topic.parentTopic}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  {topic.levels.map((level) => (
                    <Badge variant="secondary" key={level.bloomLevel}>
                      {levelLabel(level.bloomLevel)}:{" "}
                      {Math.round(level.score * 100)}% · {level.count}{" "}
                      {level.count === 1 ? "observation" : "observations"}
                      {level.needsReview && " · low confidence"}
                    </Badge>
                  ))}
                </div>
                {topic.levels.some((level) => level.needsReview) && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Low-confidence levels rest on few observations. More reviewed
                    practice on this topic is the way to settle them.
                  </p>
                )}
              </article>
            ))}
          </section>
        ))
      ) : (
        <EmptyState
          title="Evidence takes practice"
          description="Complete a reviewed activity in one of your courses and it will appear here as evidence."
        >
          <Button asChild size="sm">
            <Link href="/courses">Go to your courses</Link>
          </Button>
        </EmptyState>
      )}
      {competency.data?.competencies.length ? (
        <nav
          aria-label="Next steps"
          className="mt-4 flex flex-wrap gap-3 border-t pt-6 text-sm font-medium"
        >
          <Link href="/courses" className="rounded-lg border px-4 py-2 hover:bg-muted/50">
            Continue a course
          </Link>
          <Link href="/study-together" className="rounded-lg border px-4 py-2 hover:bg-muted/50">
            Explain it with peers
          </Link>
        </nav>
      ) : null}
    </>
  );
}
