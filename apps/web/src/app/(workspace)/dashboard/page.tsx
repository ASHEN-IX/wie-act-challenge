import Link from "next/link";
import { hasTeachingAccess } from "@/server/teaching";
import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getCourses } from "@/features/courses/queries";
import { isCourseReady } from "@/features/courses/lifecycle";
import { load } from "@/lib/api";
import { TaskList, type Task } from "@/features/tasks/task-list";
import type { LearningRewards } from "@/features/rewards/types";
import {
  orderHomeActions,
  normalizeLearningProfile,
  type HomeAction,
  type LearningProfile,
} from "@ednova/shared/ednova/learningProfile";

export const metadata = { title: "Overview — Noveris" };

// One line each: where it goes and what happens there.
const QUICK_ACTIONS = [
  {
    id: "courses",
    href: "/courses",
    label: "My Learning",
    hint: "Your courses, practice and tutor",
    icon: BookOpen,
  },
  {
    id: "study_together",
    href: "/study-together",
    label: "Study Together",
    hint: "Join or start a live room",
    icon: Users,
  },
  {
    id: "visual_lab",
    href: "/visual-lab",
    label: "Visual Lab",
    hint: "Standalone experiments, practice only",
    icon: FlaskConical,
  },
] as const;

export default async function Dashboard() {
  if (await hasTeachingAccess()) {
    const courses = await getCourses();
    return (
      <div className="space-y-8">
        <PageHeader
          title="Teaching workspace"
          description="Upload your material, review the course, then publish it for your students."
          action={
            <Button asChild>
              <Link href="/courses/new">Upload course</Link>
            </Button>
          }
        />
        <DataError message={courses.error} />
        <section aria-label="Your courses" className="space-y-3">
          <h2 className="text-lg font-semibold">Your courses</h2>
          {courses.data?.courses.length ? (
            courses.data.courses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border p-5 hover:bg-muted/40"
              >
                <span className="font-medium">{course.title}</span>
                <span className="text-sm text-muted-foreground">
                  Open course →
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload your first course to get started.
            </p>
          )}
        </section>
        <nav
          aria-label="Teaching tools"
          className="flex flex-wrap gap-5 text-sm underline underline-offset-4"
        >
          <Link href="/instructor-insights">View instructor insights</Link>
        </nav>
      </div>
    );
  }
  const [courses, tasks, rewards, learning] = await Promise.all([
    getCourses(),
    load<{ tasks: Task[] }>("/api/v1/study/tasks"),
    load<LearningRewards>("/api/v1/users/learning-rewards"),
    load<{ learningProfile: LearningProfile }>("/api/v1/users/profile/learning"),
  ]);
  const profile = learning.data
    ? normalizeLearningProfile(learning.data.learningProfile)
    : null;
  const actionOrder: HomeAction[] = orderHomeActions(profile);
  const quickActions = [...QUICK_ACTIONS].sort(
    (a, b) => actionOrder.indexOf(a.id) - actionOrder.indexOf(b.id),
  );

  // The first course that is published for learning. The app does not track
  // "last opened", so the card says Next course rather than implying history.
  const activeCourse = courses.data?.courses?.find(isCourseReady);
  const pendingTasks = (tasks.data?.tasks || []).filter(
    (t) => t.status !== "completed",
  );

  return (
    <div className="space-y-10">
      <PageHeader
        title="Overview"
        description="Open a course to read, practice and study with peers, or join your teacher’s course."
        action={<Button asChild variant="outline"><Link href="/courses#join-course">Join a course</Link></Button>}
      />

      <DataError message={courses.error || tasks.error} />

      {profile?.onboardingStatus === "pending" && (
        <div
          role="note"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
        >
          <p className="text-sm">
            Tell us how you like to learn so suggestions fit you. It takes a
            minute and you can skip it.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/onboarding">Set up my learning</Link>
          </Button>
        </div>
      )}

      <section aria-label="Next step">
        {activeCourse ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your course
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">
                {activeCourse.title}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/courses/${activeCourse.id}/learn`}>
                  Open course
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/study-together?courseId=${activeCourse.id}`}>
                  Study with peers
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                No course is published for you yet
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Join your teacher’s course with its code. You can also try a
                standalone experiment while you wait.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/courses#join-course">Join a course</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/visual-lab">Open Visual Lab</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      <nav
        aria-label="Quick actions"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {quickActions.map(({ href, label, hint, icon: Icon }) => (
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
