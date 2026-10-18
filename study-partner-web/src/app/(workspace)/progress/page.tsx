import { load } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
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
    load<{
      total_xp: number;
      level: number;
      achievements: { name?: string; title?: string }[];
    }>("/api/v1/users/gamification"),
  ]);
  return (
    <>
      <PageHeader
        title="Progress, with perspective"
        description="Review your learning evidence. XP reflects activity, not mastery."
      />
      <DataError message={competency.error || rewards.error} />
      <div className="mb-10 flex gap-10 border-b pb-8">
        <div>
          <p className="text-sm text-muted-foreground">Activity XP</p>
          <p className="mt-2 text-3xl font-semibold">
            {rewards.data?.total_xp ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Level</p>
          <p className="mt-2 text-3xl font-semibold">
            {rewards.data?.level ?? "—"}
          </p>
        </div>
      </div>
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
