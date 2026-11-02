import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  PencilLine,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getCourses } from "@/features/courses/queries";
import { load } from "@/lib/api";
import { TaskList, type Task } from "@/features/tasks/task-list";
import type { LearningRewards } from "@/features/rewards/types";

export const metadata = { title: "Overview — EdNova" };

// One line each: where it goes and what happens there.
const QUICK_ACTIONS = [
  {
    href: "/visual-lab",
    label: "Visual Lab",
    hint: "See a concept as an experiment",
    icon: FlaskConical,
  },
  {
    href: "/practice",
    label: "Practice",
    hint: "Explain your thinking, get feedback",
    icon: PencilLine,
  },
  {
    href: "/study-together",
    label: "Study Together",
    hint: "Join or start a live room",
    icon: Users,
  },
  {
    href: "/courses",
    label: "Courses",
    hint: "Your library and sources",
    icon: BookOpen,
  },
] as const;

export default async function Dashboard() {
  const [courses, tasks, rewards] = await Promise.all([
    getCourses(),
    load<{ tasks: Task[] }>("/api/v1/study/tasks"),
    load<LearningRewards>("/api/v1/users/learning-rewards"),
  ]);

  const activeCourse = courses.data?.courses?.[0];
  const pendingTasks = (tasks.data?.tasks || []).filter(
    (t) => t.status !== "completed",
  );

  return (
    <div className="space-y-10">
      <PageHeader
        title="Overview"
        description="Pick up where you left off, or start something new."
      />

      <DataError message={courses.error || tasks.error} />

      <section aria-label="Next step">
        {activeCourse ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Continue
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">
                {activeCourse.title}
              </h2>
            </div>
            <Button asChild>
              <Link href={`/courses/${activeCourse.id}`}>
                Open course
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Start with a concept
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Turn any topic into an experiment you can change and explain.
              </p>
            </div>
            <Button asChild>
              <Link href="/visual-lab">
                Open Visual Lab
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        )}
      </section>

      <nav
        aria-label="Quick actions"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {QUICK_ACTIONS.map(({ href, label, hint, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block font-medium">{label}</span>
              <span className="block text-sm text-muted-foreground">
                {hint}
              </span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">To do</h2>
            <Link
              href="/tasks"
              className="text-sm font-medium text-primary hover:underline"
            >
              All tasks ({pendingTasks.length})
            </Link>
          </div>
          <TaskList tasks={pendingTasks.slice(0, 4)} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Progress</h2>
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">
                Level {rewards.data?.level ?? 1}
              </span>
              <span className="text-sm text-muted-foreground">
                {rewards.data?.totalXp ?? 0} XP
              </span>
            </div>
            <progress
              aria-label="Progress to next level"
              value={rewards.data?.levelProgress ?? 0}
              max={rewards.data?.nextLevelXp ?? 100}
              className="h-2 w-full overflow-hidden rounded-full bg-muted accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              XP counts practice activity. It is not a mastery score.
            </p>
            <Link
              href="/progress"
              className="text-sm font-medium text-primary hover:underline"
            >
              See your evidence and badges
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
