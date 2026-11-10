"use client";
import { ActionForm } from "@/components/shared/action-form";
import { setVisibilityAction } from "./actions";
import type { CourseVisibility } from "./types";

const COPY: Record<CourseVisibility, { title: string; detail: string }> = {
  private: {
    title: "Only me",
    detail: "Nobody else can find or open this course.",
  },
  institution: {
    title: "My institution",
    detail:
      "Students you enroll through your institution can open it. This is the default.",
  },
  public: {
    title: "Anyone on Noveris",
    detail:
      "Any signed-in learner can find it in Explore and open it, even outside your institution. They cannot edit it or see other learners.",
  },
};

/** Who can open this course. Changing it never changes the course itself. */
export function VisibilityCard({
  courseId,
  scope,
  visibility,
  published,
}: {
  courseId: string;
  scope: "personal" | "institutional";
  visibility: CourseVisibility;
  published: boolean;
}) {
  const options: CourseVisibility[] =
    scope === "institutional"
      ? ["institution", "public"]
      : ["private", "public"];
  return (
    <section
      aria-labelledby="visibility-title"
      className="mb-6 rounded-lg border bg-card p-5"
    >
      <h2 id="visibility-title" className="text-base font-semibold">
        Who can open this course
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You can change this at any time. Learners already inside keep their
        progress.
      </p>
      <ActionForm
        action={setVisibilityAction}
        submit="Save"
        className="mt-4 flex flex-col gap-4"
      >
        <input type="hidden" name="courseId" value={courseId} />
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Course visibility</legend>
          {options.map((value) => {
            const blocked = value === "public" && !published;
            return (
              <label
                key={value}
                className={`flex gap-3 rounded-md border p-3 text-sm ${blocked ? "opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={value}
                  defaultChecked={visibility === value}
                  disabled={blocked}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{COPY[value].title}</span>
                  <span className="block text-muted-foreground">
                    {COPY[value].detail}
                  </span>
                  {blocked && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Publish the course first to make it public.
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      </ActionForm>
    </section>
  );
}
