import { plural } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight, BookOpen, PencilLine, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getCourses } from "@/features/courses/queries";
import { load } from "@/lib/api";
import { TaskList, type Task } from "@/features/tasks/task-list";
export const metadata = { title: "Overview" };
export default async function Dashboard() {
  const [courses, tasks] = await Promise.all([
    getCourses(),
    load<{ tasks: Task[] }>("/api/v1/study/tasks"),
  ]);
  return (
    <>
      <PageHeader
        title="Make room for understanding."
        description="Choose one thing to work on. Your next step starts here."
        action={
          <Button asChild>
            <Link href="/courses/new">Upload a course</Link>
          </Button>
        }
      />
      <DataError message={courses.error || tasks.error} />
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        {[
          {
            href: "/courses",
            title: "Your courses",
            description: `${plural(courses.data?.courses.length ?? 0, "course")} in your library`,
            icon: BookOpen,
          },
          {
            href: "/practice",
            title: "Practice a concept",
            description: "Explain your thinking. Get private feedback.",
            icon: PencilLine,
          },
          {
            href: "/study-together",
            title: "Learn with your peers",
            description: "Create a room or join with an invite code.",
            icon: Users,
          },
        ].map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-4 rounded-lg border p-6 transition-colors hover:bg-muted"
          >
            <Icon className="size-6 text-primary" />
            <h2 className="flex items-center justify-between text-lg font-semibold">
              {title}
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </Link>
        ))}
      </div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your next tasks</h2>
        <Link href="/tasks" className="text-sm font-medium text-primary">
          View all tasks
        </Link>
      </div>
      <TaskList
        tasks={(tasks.data?.tasks || [])
          .filter((t) => t.status !== "completed")
          .slice(0, 4)}
      />
    </>
  );
}
