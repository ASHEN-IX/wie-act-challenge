import Link from "next/link";
import { BarChart3, BookOpen, FlaskConical, PencilLine, Users } from "lucide-react";

export interface JourneyStep {
  href: string;
  label: string;
  hint: string;
  icon: typeof BookOpen;
}

/**
 * The learner's next moves for one course. Every link keeps the course in
 * context; "Explore visually" is offered only when the course's published
 * material actually contains something the Visual Lab can render.
 */
export function courseJourney(
  courseId: string,
  visualConcepts: number,
  revisionId?: string,
): JourneyStep[] {
  const learn = `/courses/${courseId}/learn${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ""}`;
  const steps: JourneyStep[] = [
    {
      href: learn,
      label: "Read",
      hint: "The published lesson",
      icon: BookOpen,
    },
  ];
  if (visualConcepts > 0)
    steps.push({
      href: `${learn}#explore-visually`,
      label: "Explore visually",
      hint: `${visualConcepts} concept${visualConcepts === 1 ? "" : "s"} from this course`,
      icon: FlaskConical,
    });
  steps.push(
    {
      href: `${learn}#practice-and-tutor`,
      label: "Practice",
      hint: "Feedback and the tutor",
      icon: PencilLine,
    },
    {
      href: `/study-together?courseId=${courseId}${revisionId ? `&revisionId=${encodeURIComponent(revisionId)}` : ""}`,
      label: "Study with peers",
      hint: "Start or join a room",
      icon: Users,
    },
    {
      href: "/progress",
      label: "Progress",
      hint: "Your accepted evidence",
      icon: BarChart3,
    },
  );
  return steps;
}

export function CourseJourney({
  courseId,
  visualConcepts,
  revisionId,
  current,
}: {
  courseId: string;
  visualConcepts: number;
  revisionId?: string;
  current?: string;
}) {
  return (
    <nav aria-label="Learning steps for this course">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {courseJourney(courseId, visualConcepts, revisionId).map(
          ({ href, label, hint, icon: Icon }, index) => (
            <li key={label}>
              <Link
                href={href}
                aria-current={current === label ? "step" : undefined}
                className="flex h-full items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring aria-[current=step]:border-primary/50 aria-[current=step]:bg-muted/40"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    <span className="sr-only">Step {index + 1}: </span>
                    {label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </Link>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}
