import { plural } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/states";
import type { Course, Subject } from "./types";
import { courseStage, courseStageLabel } from "./lifecycle";
export function CourseList({
  courses,
  subjects,
  teaching = false,
}: {
  courses: Course[];
  subjects: Subject[];
  teaching?: boolean;
}) {
  return (
    <div
      className="space-y-6"
    >
      <div className="flex min-w-0 flex-col gap-5">
        {courses.length ? (
          courses.map((course) => {
            const stage = courseStage(course);
            return (
              <article
                key={course.id}
                className="flex flex-col items-stretch gap-5 rounded-lg border p-5 sm:flex-row sm:items-center sm:p-6"
              >
                <div className="hidden h-28 w-20 shrink-0 sm:flex items-center justify-center rounded-md bg-secondary text-primary">
                  <BookOpen className="size-8" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-lg font-semibold sm:text-xl">
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
                    <span>{plural(course.filesCount || 0, "source file")}</span>
                    <span>
                      Uploaded{" "}
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                      }).format(new Date(course.createdAt))}
                    </span>
                  </div>
                  <div className="mt-4">
                    <Badge
                      variant={
                        stage === "failed"
                          ? "destructive"
                          : stage === "ready"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {teaching && stage === "ready"
                        ? "Published"
                        : courseStageLabel(stage)}
                    </Badge>
                    <span className="ml-3 text-xs text-muted-foreground">
                      {plural(course.topicsCount || 0, "extracted topic")}
                    </span>
                  </div>
                </div>
                {teaching && course.scope === "institutional" && <Button variant="outline" asChild><Link href={`/courses/${course.id}/students`}>Invite students</Link></Button>}
                <Button variant="outline" asChild>
                  <Link href={`/courses/${course.id}`}>
                    {stage === "review" ? "Review" : "Open"}{" "}
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </article>
            );
          })
        ) : (
          <EmptyState
            title={teaching ? "Upload your first class course" : "No courses yet"}
            description={teaching ? "Choose your institution when uploading, review the lessons, then invite your students." : "Join with your teacher’s invitation code above. Your course will appear here."}
          >
            {teaching && <Button asChild><Link href="/courses/new">Upload a course</Link></Button>}
          </EmptyState>
        )}

      </div>

    </div>
  );
}
