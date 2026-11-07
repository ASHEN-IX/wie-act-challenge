"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nardouchImage, stages } from "@/lib/brand";
import type { CourseNardouchJourney } from "@ednova/shared/ednova/nardouchGrowth";
import {
  finishNardouchLesson,
  loadCourseNardouch,
} from "./course-growth-actions";

const PROGRESS_EVENT = "nardouch-course-progress";

export function refreshCourseNardouch(courseId: string, revisionId: string) {
  window.dispatchEvent(
    new CustomEvent(PROGRESS_EVENT, { detail: { courseId, revisionId } }),
  );
}

export function CourseNardouchView({
  journey,
  lessonId,
  busy,
  onComplete,
  practiceHref,
}: {
  journey: CourseNardouchJourney;
  lessonId?: string;
  busy?: boolean;
  onComplete?: (lessonId: string) => void;
  practiceHref: string;
}) {
  const stage = stages.find((entry) => entry.id === journey.stage)!;
  const lesson = lessonId
    ? journey.lessons.find((entry) => entry.id === lessonId)
    : journey.lessons.find(
        (entry) => !journey.completedLessonIds.includes(entry.id),
      );
  const done = lesson && journey.completedLessonIds.includes(lesson.id);
  return (
    <section
      aria-label="Your course Nardouch"
      data-nardouch-stage={stage.id}
      className="my-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <Image
          src={nardouchImage(stage.id)}
          alt={`${stage.name} Nardouch`}
          width={112}
          height={112}
          sizes="112px"
          quality={90}
          className="size-24 shrink-0 object-contain sm:size-28"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> Your companion for this course
          </p>
          <h2
            className="mt-1 font-heading text-lg font-semibold"
            aria-live="polite"
          >
            {stage.name} Nardouch
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {journey.graduated
              ? "You finished this course and passed every reviewed objective check. You grew together!"
              : journey.readingPercent === 100
                ? "Course reading complete! Pass the reviewed objective checks to unlock Graduate."
                : "Every course starts with Baby Nardouch. Complete lessons and watch your companion grow."}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {journey.completedLessonIds.length} / {journey.lessons.length} lessons
          completed
        </span>
        <span>
          {journey.passedChecks} / {journey.totalChecks} objective checks passed
        </span>
      </div>
      <progress
        aria-label="Course lesson completion"
        max={100}
        value={journey.readingPercent}
        className="mt-2 h-2 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-primary/10 [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
      />
      <ol
        aria-label="Nardouch growth stages"
        className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px] sm:text-xs"
      >
        {stages.map((entry) => (
          <li
            key={entry.id}
            aria-current={stage.id === entry.id ? "step" : undefined}
            className={
              stage.id === entry.id
                ? "rounded-full bg-primary/15 px-1 py-1 font-semibold text-primary"
                : "py-1 text-muted-foreground"
            }
          >
            {entry.name}
          </li>
        ))}
      </ol>
      {lesson && onComplete && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="min-w-0 text-sm">
            <span className="text-muted-foreground">
              {lessonId ? "This lesson" : "Up next"} ·{" "}
            </span>
            {lesson.title}
          </p>
          <Button
            size="sm"
            variant={done ? "outline" : "default"}
            disabled={busy || done}
            onClick={() => onComplete(lesson.id)}
          >
            {done ? <Check className="size-4" /> : null}
            {busy ? "Saving…" : done ? "Lesson completed" : "Complete lesson"}
          </Button>
        </div>
      )}
      {journey.readingPercent === 100 && !journey.graduated && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {journey.totalChecks
              ? "Your Graduate cap is one goal away: pass a reviewed check for every course objective."
              : "Reviewed checks are not available yet. Ask your instructor to add them to unlock graduation."}
          </p>
          {journey.totalChecks > 0 && (
            <Button asChild size="sm">
              <Link href={practiceHref}>
                <GraduationCap className="size-4" /> Open course checks
              </Link>
            </Button>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        Lesson completion records your reading. Graduation also requires passed
        course checks. Progress is saved for this course only.
      </p>
    </section>
  );
}

export function CourseNardouch({
  courseId,
  revisionId,
  lessonId,
  practiceHref,
}: {
  courseId: string;
  revisionId?: string;
  lessonId?: string;
  practiceHref?: string;
}) {
  const [data, setData] = useState<CourseNardouchJourney | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const journey =
    data?.courseId === courseId &&
    (!revisionId || data.revisionId === revisionId)
      ? data
      : null;
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const request = ++sequence;
      try {
        const result = await loadCourseNardouch(courseId, revisionId);
        if (active && request === sequence) {
          setData(result);
          setError("");
        }
      } catch {
        if (active && request === sequence) {
          setData(null);
          setError(
            "Your companion progress could not be loaded. Your lesson is still available.",
          );
        }
      }
    }
    function refresh(event: Event) {
      const pin = (event as CustomEvent).detail;
      if (
        pin?.courseId === courseId &&
        (!revisionId || pin.revisionId === revisionId)
      )
        void load();
    }
    void load();
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener("focus", load);
    };
  }, [courseId, revisionId, retry]);
  async function complete(id: string) {
    if (!journey || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await finishNardouchLesson(
        courseId,
        journey.revisionId,
        id,
      );
      setData(updated);
      refreshCourseNardouch(courseId, journey.revisionId);
    } catch {
      setError("Could not save lesson completion. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {journey ? (
        <CourseNardouchView
          journey={journey}
          lessonId={lessonId}
          busy={busy}
          onComplete={complete}
          practiceHref={
            practiceHref ??
            `/courses/${encodeURIComponent(courseId)}/learn?revisionId=${encodeURIComponent(journey.revisionId)}#practice-and-tutor`
          }
        />
      ) : (
        !error && (
          <p role="status" className="my-5 text-sm text-muted-foreground">
            Loading your course companion…
          </p>
        )
      )}
      {error && (
        <p role="alert" className="my-4 text-sm">
          {error}{" "}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </Button>
        </p>
      )}
    </>
  );
}
