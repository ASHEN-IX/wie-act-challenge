import { load, segment } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { InstructorInsightsPanel } from "@/features/analytics/insights-panel";
import type { InstructorInsights } from "@/features/analytics/types";

export const metadata = { title: "Instructor insights" };
export default async function InstructorInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const query = await searchParams;
  const courses = await load<{
    courses: Array<{ courseId: string; title: string }>;
  }>("/api/v1/study/insights/courses");
  const choices = courses.data?.courses || [];
  const selected = query.courseId || choices[0]?.courseId;
  const valid = selected && /^[a-f\d]{24}$/i.test(selected);
  const insights = valid
    ? await load<InstructorInsights>(
        `/api/v1/study/insights/courses/${segment(selected)}`,
      )
    : {
        error: selected ? "Choose a valid course." : undefined,
        data: undefined,
      };
  return (
    <>
      <PageHeader
        title="Instructor insights"
        description="Privacy-limited course practice summaries. Private answers, transcripts and files are never included."
      />
      <DataError message={courses.error || insights.error} />
      {choices.length ? (
        <form
          className="mb-8 flex flex-wrap items-end gap-3"
          action="/instructor-insights"
          method="get"
        >
          <label className="grid gap-2 text-sm">
            Course
            <select
              name="courseId"
              defaultValue={selected}
              className="min-w-56 rounded-md border bg-background p-2"
            >
              {choices.map((course) => (
                <option key={course.courseId} value={course.courseId}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Show course insights
          </button>
        </form>
      ) : (
        !courses.error && (
          <EmptyState
            title="No assigned courses"
            description="Insights are available only for courses where you currently hold instructor authoring access."
          />
        )
      )}
      {insights.data && <InstructorInsightsPanel insights={insights.data} />}
    </>
  );
}
