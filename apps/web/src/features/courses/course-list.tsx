import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Upload,
  Users,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/states";
import type { Course, Subject } from "./types";
export function CourseList({
  courses,
  subjects,
}: {
  courses: Course[];
  subjects: Subject[];
}) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-w-0 flex-col gap-5">
        {courses.length ? (
          courses.map((course) => (
            <article
              key={course.id}
              className="flex flex-wrap items-center gap-5 rounded-lg border p-5 sm:flex-nowrap sm:p-6"
            >
              <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                <BookOpen className="size-8" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold sm:text-xl">
                  <Link
                    href={`/courses/${course.id}`}
                    className="hover:underline"
                  >
                    {course.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {subjects.find((s) => s.id === course.subjectId)?.name ||
                    "Course material"}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <FileText className="size-4" />
                  <span>{course.filesCount || 0} source files</span>
                  <span>
                    Uploaded{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(new Date(course.createdAt))}
                  </span>
                </div>
                <div className="mt-4">
                  <Badge variant="secondary">{course.status}</Badge>
                  <span className="ml-3 text-xs text-muted-foreground">
                    {course.topicsCount || 0} extracted topics
                  </span>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/courses/${course.id}`}>
                  Open <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </article>
          ))
        ) : (
          <EmptyState
            title="Your next chapter starts here"
            description="Upload your course material to keep your sources and learning tools in one place."
          >
            <Button asChild>
              <Link href="/courses/new">Upload a course</Link>
            </Button>
          </EmptyState>
        )}
        <div className="mt-5 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Bring your course material</h2>
          <p className="text-sm text-muted-foreground">
            Lecture notes, slides or a syllabus. Start with a PDF.
          </p>
          <Link
            href="/courses/new"
            className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted"
          >
            <Upload className="size-6" />
            <span className="text-sm font-medium">
              Choose your course files
            </span>
            <span className="text-xs text-muted-foreground">
              PDF · up to 25 MB per file
            </span>
          </Link>
        </div>
      </div>
      <aside className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-5" />
              Study together
            </CardTitle>
            <CardDescription>
              Work through problems, discuss ideas and learn with your peers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/study-together">Create a room</Link>
            </Button>
            <Separator className="my-6" />
            <div className="flex gap-3">
              <Lightbulb className="size-5 shrink-0 text-primary" />
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Your next step</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Choose a source, ask a question and explain it in your own
                  words.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
