import type { InstructorInsights } from "./types";

function count(value: number | null) {
  return value === null ? "Suppressed" : value.toLocaleString();
}

export function InstructorInsightsPanel({
  insights,
}: {
  insights: InstructorInsights;
}) {
  return (
    <section aria-labelledby="insights-course-title" className="space-y-6">
      <h2 id="insights-course-title" className="text-2xl font-semibold">
        {insights.course.title}
      </h2>
      <p className="text-sm text-muted-foreground">
        Current published revision only. Counts describe accepted learning
        evidence, not academic attainment or individual performance. No learner
        drill-down is available.
      </p>
      {insights.suppressed || !insights.summary ? (
        <div role="status" className="rounded-lg border border-dashed p-6">
          <h3 className="font-medium">Course aggregates are suppressed</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {insights.suppressionReason === "policy_pending"
              ? "The cohort privacy policy is not configured. No counts are disclosed."
              : insights.suppressionReason === "small_cohort"
                ? "The active enrolled cohort is below the configured privacy threshold. No counts are disclosed."
                : "A committed reviewed source revision is required before evidence can be aggregated."}
          </p>
        </div>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ["Active enrolled learners", insights.summary.enrolledLearners],
              [
                "Learners with verified practice",
                insights.summary.practicedLearners,
              ],
              [
                "Learners with accepted objective evidence",
                insights.summary.masteredLearners,
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border p-5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold">
                  {count(value as number | null)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Small cells and their complements are suppressed. Zero and uniform
            outcome cells are also hidden. Threshold configuration is
            provisional pending policy review.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <section
              className="rounded-lg border p-5"
              aria-labelledby="insights-activities"
            >
              <h3 id="insights-activities" className="mb-4 font-medium">
                Practice by activity type
              </h3>
              <dl className="space-y-3">
                {insights.activityBreakdown.map((row) => (
                  <div
                    key={row.activityType}
                    className="flex flex-wrap justify-between gap-3"
                  >
                    <dt>
                      {row.activityType === "InteractiveQuiz"
                        ? "Quiz"
                        : "Guided problem"}
                    </dt>
                    <dd>{count(row.practicedLearners)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section
              className="overflow-x-auto rounded-lg border p-5"
              aria-labelledby="insights-trends"
            >
              <h3 id="insights-trends" className="mb-4 font-medium">
                Verified practice in completed UTC weeks
              </h3>
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Distinct learners with verified practice, by completed
                  calendar week
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="pb-3">
                      Week
                    </th>
                    <th scope="col" className="pb-3">
                      Learners
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {insights.trends.map((row) => (
                    <tr key={row.week} className="border-t">
                      <th scope="row" className="py-2 font-normal">
                        {row.week}
                      </th>
                      <td>{count(row.practicedLearners)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
