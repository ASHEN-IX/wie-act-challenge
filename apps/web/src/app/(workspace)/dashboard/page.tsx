import { plural } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  PencilLine,
  Users,
  Sparkles,
  Trophy,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getCourses } from "@/features/courses/queries";
import { load } from "@/lib/api";
import { TaskList, type Task } from "@/features/tasks/task-list";
import type { LearningRewards } from "@/features/rewards/types";

export const metadata = { title: "Overview — EdNova" };

export default async function Dashboard() {
  const [courses, tasks, rewards] = await Promise.all([
    getCourses(),
    load<{ tasks: Task[] }>("/api/v1/study/tasks"),
    load<LearningRewards>("/api/v1/users/learning-rewards"),
  ]);

  const activeCourse = courses.data?.courses?.[0];
  const pendingTasks = (tasks.data?.tasks || []).filter((t) => t.status !== "completed");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back to EdNova."
        description="Active, interactive, collaborative, and measurable learning."
        action={
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/study-together">
                <Users className="mr-1.5 size-4" />
                Study Together
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/courses/new">
                <BookOpen className="mr-1.5 size-4" />
                Upload Course
              </Link>
            </Button>
          </div>
        }
      />

      <DataError message={courses.error || tasks.error} />

      {/* Hero / Continue Learning Section */}
      {activeCourse ? (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/2 to-transparent shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1 font-medium text-primary">
                <Sparkles className="size-3" />
                Continue Learning
              </Badge>
              <span className="text-xs text-muted-foreground">
                Last updated recently
              </span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight mt-2">
              {activeCourse.title}
            </CardTitle>
            <CardDescription className="line-clamp-2 max-w-2xl text-sm">
              {activeCourse.description || "Pick up right where you left off with interactive exercises and Socratic feedback."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{activeCourse.topics?.length ?? 1} topics available</span>
              <span>•</span>
              <span>Mastery tracked by Bloom taxonomy</span>
            </div>
            <Button asChild className="gap-2">
              <Link href={`/courses/${activeCourse.id}`}>
                Resume topic
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Primary Action Triad */}
      <div className="grid gap-6 md:grid-cols-3">
        <Link
          href="/courses"
          className="group relative flex flex-col justify-between rounded-xl border bg-card p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
              Your Courses
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {plural(courses.data?.courses.length ?? 0, "course")} in your library. Explore digitized chapters and source references.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-primary">
            <span>Browse courses</span>
            <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          href="/practice"
          className="group relative flex flex-col justify-between rounded-xl border bg-card p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PencilLine className="size-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
              Socratic Practice
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Test your understanding with multi-step guided problems, source hints, and private evaluations.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-primary">
            <span>Start practice</span>
            <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          href="/study-together"
          className="group relative flex flex-col justify-between rounded-xl border bg-card p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="size-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
              Study Together
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Collaborate live with peers and an AI voice moderator. Voice, canvas, and private understanding checks.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-primary">
            <span>Join or create room</span>
            <ArrowRight className="ml-1 size-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </div>

      {/* Dual Section: Tasks & Motivation Progress */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              <h2 className="text-xl font-semibold tracking-tight">Your Action Items</h2>
            </div>
            <Link href="/tasks" className="text-xs font-semibold text-primary hover:underline">
              View all tasks ({pendingTasks.length})
            </Link>
          </div>
          <TaskList tasks={pendingTasks.slice(0, 4)} />
        </div>

        {/* Motivation / XP Snapshot */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            <h2 className="text-xl font-semibold tracking-tight">Motivation Progress</h2>
          </div>
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Current Level</span>
                <Badge variant="outline" className="font-semibold text-primary">
                  Lvl {rewards.data?.level ?? 1}
                </Badge>
              </div>
              <CardTitle className="text-3xl font-extrabold tracking-tight">
                {rewards.data?.totalXp ?? 0} <span className="text-sm font-normal text-muted-foreground">XP</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Level Progress</span>
                  <span>
                    {rewards.data?.levelProgress ?? 0} / {rewards.data?.nextLevelXp ?? 100} XP
                  </span>
                </div>
                <progress
                  aria-label="Level progression"
                  value={rewards.data?.levelProgress ?? 0}
                  max={rewards.data?.nextLevelXp ?? 100}
                  className="h-2 w-full rounded-full overflow-hidden bg-muted accent-primary"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal border-t pt-2.5">
                XP reflects deliberate practice activity, distinct from Bloom taxonomy academic mastery.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full mt-2 text-xs">
                <Link href="/progress">View Verified Evidence & Badges</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
