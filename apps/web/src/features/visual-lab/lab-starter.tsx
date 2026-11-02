"use client";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCourseLab,
  createTopicLab,
  type LabActionState,
} from "./actions";

const EXAMPLES = [
  { label: "Shortest path", concept: "Dijkstra's shortest path algorithm" },
  { label: "Force and mass", concept: "Newton's second law" },
  { label: "Projectile in 3D", concept: "projectile motion launch angle" },
  { label: "Parabola", concept: "quadratic function vertex and roots" },
] as const;

const initial: LabActionState = {};

const ENGINE_LABEL = {
  weighted_graph: "Graph · 2D",
  parameter_model: "Experiment · 2D",
  spatial_3d: "Scene · 3D",
  function_plot: "Function plot",
} as const;

export interface Suggestion {
  sectionId: string;
  concept: string;
  excerpt: string;
  engine: keyof typeof ENGINE_LABEL;
}

function SuggestionRow({
  courseId,
  suggestion,
}: {
  courseId: string;
  suggestion: Suggestion;
}) {
  const [state, action, pending] = useActionState(createCourseLab, initial);
  return (
    <li>
      <form action={action} className="flex flex-col gap-2 px-4 py-3">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="topicId" value={suggestion.sectionId} />
        <input type="hidden" name="concept" value={suggestion.concept} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">{suggestion.concept}</span>
            <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
              {suggestion.excerpt}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{ENGINE_LABEL[suggestion.engine]}</Badge>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden />}
              {pending ? "Building…" : "Explore"}
            </Button>
          </div>
        </div>
        {state.error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
      </form>
    </li>
  );
}

export function LabStarter({
  courses,
  courseId,
  suggestions,
  discoveryNote,
}: {
  courses: Array<{ id: string; title: string; status?: string }>;
  courseId?: string;
  suggestions: Suggestion[];
  discoveryNote?: string;
}) {
  const router = useRouter();
  const [courseState, courseAction, coursePending] = useActionState(
    createCourseLab,
    initial,
  );
  const [topicState, topicAction, topicPending] = useActionState(
    createTopicLab,
    initial,
  );

  const [, startExample] = useTransition();
  function runExample(concept: string) {
    const data = new FormData();
    data.set("concept", concept);
    startExample(() => topicAction(data));
  }

  return (
    <div className="flex flex-col gap-10">
      {courses.length > 0 && courseId && (
        <section aria-labelledby="from-course" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="from-course" className="text-lg font-semibold">
              From your course
            </h2>
            <div className="flex items-center gap-2">
              <Label htmlFor="lab-course" className="sr-only">
                Course
              </Label>
              <select
                id="lab-course"
                value={courseId}
                onChange={(event) =>
                  router.replace(`/visual-lab?courseId=${event.target.value}`)
                }
                className="h-9 max-w-[16rem] rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {suggestions.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Parts of this course the lab can show as an interactive
                experiment.
              </p>
              <ul className="flex flex-col divide-y rounded-xl border">
                {suggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion.sectionId}
                    courseId={courseId}
                    suggestion={suggestion}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              {discoveryNote ??
                "No section of this course matches something the lab can show yet. Describe a concept below."}
            </p>
          )}

          <form action={courseAction} className="flex flex-col gap-2">
            <input type="hidden" name="courseId" value={courseId} />
            <Label htmlFor="lab-course-concept">
              Or describe a concept from this course
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="lab-course-concept"
                name="concept"
                required
                maxLength={500}
                placeholder="e.g. how edge weights change the shortest path"
              />
              <Button type="submit" variant="outline" disabled={coursePending}>
                {coursePending && (
                  <LoaderCircle className="animate-spin" aria-hidden />
                )}
                {coursePending ? "Building…" : "Explore"}
              </Button>
            </div>
            {courseState.error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{courseState.error}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              Only published course material grounds a lab. The revision is
              pinned, so it does not change when the course is updated.
            </p>
          </form>
        </section>
      )}

      <section aria-labelledby="from-topic" className="flex flex-col gap-3">
        <h2 id="from-topic" className="text-lg font-semibold">
          Start from a topic
        </h2>
        <form action={topicAction} className="flex flex-col gap-2">
          <Label htmlFor="lab-topic" className="sr-only">
            Topic
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="lab-topic"
              name="concept"
              required
              maxLength={500}
              placeholder="e.g. Dijkstra's algorithm, Newton's second law, projectile motion"
            />
            <Button type="submit" variant="outline" disabled={topicPending}>
              {topicPending && (
                <LoaderCircle className="animate-spin" aria-hidden />
              )}
              {topicPending ? "Building…" : "Create lab"}
            </Button>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Examples"
          >
            <span className="text-xs text-muted-foreground">Try:</span>
            {EXAMPLES.map((example) => (
              <Button
                key={example.concept}
                type="button"
                size="xs"
                variant="outline"
                disabled={topicPending}
                onClick={() => runExample(example.concept)}
              >
                {example.label}
              </Button>
            ))}
          </div>
          {topicState.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{topicState.error}</AlertDescription>
            </Alert>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            A topic lab is a general example, never presented as course
            material.
          </p>
        </form>
      </section>
    </div>
  );
}
