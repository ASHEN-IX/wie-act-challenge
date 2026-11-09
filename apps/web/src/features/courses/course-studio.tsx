"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActivityRenderer } from "@/features/learning/activity-renderer";
import type { ActivityDefinition } from "@/lib/activity-contracts";
import type {
  CourseDraft,
  DraftTopic,
  DraftLearningObjective,
  ActivityCandidateResult,
} from "./types";
import {
  updateDraftAction,
  publishRevisionAction,
  generateCandidateActivity,
  registerCandidateActivity,
} from "./actions";

import {
  loadStudio,
  prepareStudio,
  uploadStudioSource,
  studioIngestStatus,
  controlStudioIngestion,
  reviewDraft,
} from "./studio-actions";
import { approveStudioPublication } from "./formula-actions";
import { FormulaReview } from "./formula-review";
import { CourseReviewPanel } from "./course-review-panel";
import { autoReviewAndPublish, type AutoPublishPhase } from "./auto-publish";
import type { DraftReviewProposal } from "./studio-actions";
import { cn } from "@/lib/utils";

interface CourseStudioProps {
  courseId: string;
  courseTitle: string;
  initialDraft: CourseDraft;
  currentUserId: string;
  originalFiles?: Array<{ filename: string; originalName?: string }>;
  /** A published revision already exists: never auto-publish a follow-up draft. */
  hasPublishedRevision?: boolean;
}

const LESSONS_PER_PAGE = 8;

export function CourseStudio({
  courseId,
  courseTitle,
  initialDraft,
  currentUserId,
  originalFiles = [],
  hasPublishedRevision = false,
}: CourseStudioProps) {
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [sourceState, setSourceState] = useState<Awaited<
    ReturnType<typeof loadStudio>
  > | null>(null);
  const [sourceChunkId, setSourceChunkId] = useState("");
  const sourceSectionId = "";
  const [generationLanguage, setGenerationLanguage] = useState<
    "en" | "fr" | "ar" | "ary"
  >("en");
  const [generationDifficulty, setGenerationDifficulty] = useState<
    "beginner" | "standard" | "advanced"
  >("beginner");
  const [hintDepth, setHintDepth] = useState<"none" | "cue" | "context">(
    "none",
  );
  const [ingestionStatus, setIngestionStatus] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [ingestion, setIngestion] = useState(
    initialDraft.topics?.length
      ? initialDraft.isInstructorReviewed
        ? "Reviewed draft ready to prepare and publish."
        : "Draft ready for review."
      : "Choose a source to begin.",
  );
  const [step, setStep] = useState<1 | 2 | 3>(
    initialDraft.topics?.length ? 2 : 1,
  );
  const [candidateReviewed, setCandidateReviewed] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  useEffect(() => {
    loadStudio(courseId)
      .then(setSourceState)
      .catch((e) => setErrorMsg(e.message));
  }, [courseId]);

  useEffect(() => {
    setExtractionReviewAcknowledged(
      sourceState?.extractionReview?.acknowledged === true,
    );
  }, [
    sourceState?.draft.revisionTag,
    sourceState?.extractionReview?.acknowledged,
  ]);

  // Uploading starts a server-owned job. While it runs, refresh the draft so
  // the instructor sees the real outline without hunting for a status button.
  useEffect(() => {
    if (ingestionStatus?.status !== "processing") return;
    const timer = window.setInterval(() => {
      studioIngestStatus(courseId)
        .then(async (status) => {
          setIngestionStatus(status);
          setIngestion(
            [status.stage, status.detail].filter(Boolean).join(" · ") ||
              "Reading the source",
          );
          if (status.status === "processing") return;
          window.clearInterval(timer);
          if (status.status === "completed") {
            await refreshStudio();
            setStep(2);
          }
        })
        .catch(() =>
          setErrorMsg(
            "We could not check processing. Check your connection and reload to try again.",
          ),
        );
    }, 2500);
    return () => window.clearInterval(timer);
    // refreshStudio closes over the latest render; only restart on a new job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, ingestionStatus?.status, ingestionStatus?.jobId]);
  async function refreshStudio() {
    const state = await loadStudio(courseId);
    setSourceState(state);
    setDraft(state.draft);
    setDirty(false);
    setTopics(state.draft.topics || []);
    setSummary(state.draft.summary || "");
    setIsInstructorReviewed(state.draft.isInstructorReviewed);
    return state;
  }

  const [topics, setTopics] = useState<DraftTopic[]>(initialDraft.topics || []);
  const [manualObjective, setManualObjective] = useState("");
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState(-1);
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [summary, setSummary] = useState(initialDraft.summary || "");
  const [isInstructorReviewed, setIsInstructorReviewed] = useState(
    initialDraft.isInstructorReviewed,
  );
  const [extractionReviewAcknowledged, setExtractionReviewAcknowledged] =
    useState(false);

  const [activeObjective, setActiveObjective] =
    useState<DraftLearningObjective | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<
    "InteractiveQuiz" | "GuidedProblem"
  >("InteractiveQuiz");

  const [activityProposal, setActivityProposal] =
    useState<ActivityCandidateResult | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(
    null,
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const generationSerial = useRef(0);
  const generationKey = JSON.stringify([
    draft.revisionTag,
    topics,
    summary,
    sourceChunkId,
    sourceSectionId,
    generationLanguage,
    generationDifficulty,
    hintDepth,
    selectedActivityType,
  ]);
  const latestGenerationKey = useRef(generationKey);
  latestGenerationKey.current = generationKey;

  const handleObjectiveTextChange = (
    topicIdx: number,
    subIdx: number,
    objIdx: number,
    newText: string,
  ) => {
    setDirty(true);
    setIsInstructorReviewed(false);
    setActivityProposal(null);
    setTopics(
      topics.map((topic, t) =>
        t !== topicIdx
          ? topic
          : {
              ...topic,
              subtopics: topic.subtopics?.map((sub, s) =>
                s !== subIdx
                  ? sub
                  : {
                      ...sub,
                      learning_objectives: sub.learning_objectives?.map(
                        (objective, o) =>
                          o !== objIdx
                            ? objective
                            : {
                                ...objective,
                                text: newText,
                                statement: newText,
                                provenance: "manual",
                              },
                      ),
                    },
              ),
            },
      ),
    );
  };

  /** Apply an AI proposal to the editor state only. Returns the number of items changed. */
  const applyReviewProposal = (proposal: DraftReviewProposal) => {
    const chapterTitles = new Map(
      proposal.chapters.map((c) => [c.id, c.title]),
    );
    const lessons = new Map(proposal.lessons.map((l) => [l.id, l]));
    let changed = 0;
    setTopics(
      topics.map((topic, index) => {
        const title = chapterTitles.get(topic.id || `ch_${index}`);
        if (title && title !== topic.title) changed += 1;
        return {
          ...topic,
          title: title ?? topic.title,
          subtopics: topic.subtopics?.map((sub) => {
            const next = lessons.get(sub.id);
            if (!next) return sub;
            changed += 1;
            return {
              ...sub,
              title: next.title,
              learning_objectives: next.objectives.map((o) => ({
                id: "obj_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12),
                statement: o.statement,
                text: o.statement,
                bloomLevel: o.bloomLevel,
                provenance: "ai_generated" as const,
              })),
            };
          }),
        };
      }),
    );
    if (changed) {
      setDirty(true);
      setIsInstructorReviewed(false);
      setActivityProposal(null);
    }
    return changed;
  };

  const handleSaveDraft = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("courseId", courseId);
      form.set("expectedRevisionTag", draft.revisionTag);
      form.set("topicsJson", JSON.stringify(topics));
      form.set("summary", summary);
      form.set("isInstructorReviewed", isInstructorReviewed ? "true" : "false");
      form.set(
        "extractionReviewAcknowledged",
        extractionReviewAcknowledged ? "true" : "false",
      );

      const res = await updateDraftAction({}, form);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        try {
          await refreshStudio();
          setActivityProposal(null);
          setSourceChunkId("");
          setSuccessMsg(
            res.success ||
              "Draft revision saved. Prepare the new revision before generation or publication.",
          );
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : "Reload required");
        }
      }
    });
  };

  const AUTO_KEY = "ednova:auto-publish";
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [auto, setAuto] = useState<{
    phase: "idle" | AutoPublishPhase | "published" | "held";
    message?: string;
  }>({ phase: "idle" });
  const autoRan = useRef<string | null>(null);
  const autoBusy = useRef(false);
  /** Read at the moment of deciding. If storage is unavailable the opt-out cannot be
   * honoured, so the automatic path stays off; the manual button still works. */
  const autoAllowed = () => {
    try {
      return localStorage.getItem(AUTO_KEY) === "on";
    } catch {
      return false;
    }
  };
  const latest = useRef({ dirty, published, isInstructorReviewed });
  useEffect(() => {
    latest.current = { dirty, published, isInstructorReviewed };
  });
  const untouched = () =>
    !latest.current.dirty &&
    !latest.current.published &&
    !latest.current.isInstructorReviewed;
  useEffect(() => {
    try {
      setAutoEnabled(localStorage.getItem(AUTO_KEY) === "on");
    } catch {
      /* Storage can be blocked; automatic review stays off. */
    }
  }, []);

  /** Check, fix what is clearly fixable, then publish, with no manual steps. */
  const runAuto = async (automatic = false) => {
    if (autoBusy.current) return;
    autoBusy.current = true;
    try {
      await runAutoOnce(automatic);
    } finally {
      autoBusy.current = false;
    }
  };
  const runAutoOnce = async (automatic: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    let tag = draft.revisionTag;
    let acknowledged = sourceState?.extractionReview?.acknowledged === true;
    const result = await autoReviewAndPublish({
      topics,
      needsSave:
        dirty || topics.some((t) => t.subtopics?.some((sub) => !sub.id)),
      onPhase: (phase) => setAuto({ phase }),
      canContinue: automatic ? () => autoAllowed() && untouched() : undefined,
      save: async (next, reviewed) => {
        const form = new FormData();
        form.set("courseId", courseId);
        form.set("expectedRevisionTag", tag);
        form.set("topicsJson", JSON.stringify(next));
        form.set("summary", summary);
        form.set("isInstructorReviewed", reviewed ? "true" : "false");
        form.set(
          "extractionReviewAcknowledged",
          acknowledged ? "true" : "false",
        );
        const saved = await updateDraftAction({}, form);
        if (saved.error) throw new Error(saved.error);
      },
      refresh: async () => {
        const state = await refreshStudio();
        tag = state.draft.revisionTag;
        acknowledged = state.extractionReview?.acknowledged === true;
        return { revisionTag: tag, topics: state.draft.topics || [] };
      },
      review: (useAi) => reviewDraft(courseId, useAi),
      approve: async (revisionTag) => {
        const approved = await approveStudioPublication(
          courseId,
          revisionTag,
          acknowledged,
        );
        return approved.ok
          ? { ok: true }
          : { ok: false, error: approved.error };
      },
      prepare: async (revisionTag) =>
        setSourceState(await prepareStudio(courseId, revisionTag)),
      publish: async (revisionTag) => {
        const form = new FormData();
        form.set("courseId", courseId);
        form.set("expectedRevisionTag", revisionTag);
        const out = await publishRevisionAction({}, form);
        return { error: out.error, revisionTag: out.publishedRevisionTag };
      },
    });
    if (result.status === "published") {
      setIsInstructorReviewed(true);
      setPublished(result.revisionTag);
      setStep(3);
      setAuto({
        phase: "published",
        message:
          (result.fixed
            ? `Published automatically. ${result.fixed} unclear lesson${result.fixed === 1 ? " was" : "s were"} improved first.`
            : "Published automatically.") +
          (result.remaining
            ? ` ${result.remaining} suggestion${result.remaining === 1 ? "" : "s"} could not be fixed automatically${
                result.aiStatus === "proposed"
                  ? ""
                  : " because the AI review was unavailable"
              }. You can improve ${result.remaining === 1 ? "it" : "them"} in the outline and publish again.`
            : " The checks found nothing left to fix."),
      });
    } else {
      setAuto({
        phase: "held",
        message:
          (result.fixed
            ? `${result.fixed} lesson${result.fixed === 1 ? "" : "s"} improved. `
            : "") + `Nothing was published: ${result.reason}`,
      });
    }
  };

  // Start by itself for a freshly processed, never-published course. Anything unclear
  // (still processing, status unknown, already published, being edited) does nothing; the
  // "Review and publish now" button stays available. One attempt per course per page load,
  // so the run's own saves (which change the revision tag) cannot start it again.
  useEffect(() => {
    if (
      !autoEnabled ||
      !autoAllowed() ||
      hasPublishedRevision ||
      published ||
      dirty ||
      isInstructorReviewed ||
      !topics.length ||
      ingestionStatus?.status === "processing" ||
      autoRan.current === courseId
    )
      return;
    autoRan.current = courseId;
    studioIngestStatus(courseId)
      .then((status) => {
        if (status.status === "completed" && autoAllowed() && untouched())
          return runAuto(true);
      })
      .catch(() => undefined);
    // runAuto reads the latest render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoEnabled,
    hasPublishedRevision,
    sourceState,
    courseId,
    topics.length,
    ingestionStatus?.status,
  ]);

  /** Review, save, prepare and publish the same revision in one command. */
  const handlePrepareAndPublish = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (
      sourceState?.extractionReview?.required &&
      !extractionReviewAcknowledged &&
      !sourceState.extractionReview.acknowledged
    ) {
      setErrorMsg(
        "Check the original source, then confirm the source review above before publishing.",
      );
      return;
    }
    startTransition(async () => {
      try {
        const reviewForm = new FormData();
        reviewForm.set("courseId", courseId);
        reviewForm.set("expectedRevisionTag", draft.revisionTag);
        reviewForm.set("topicsJson", JSON.stringify(topics));
        reviewForm.set("summary", summary);
        reviewForm.set("isInstructorReviewed", "true");
        reviewForm.set(
          "extractionReviewAcknowledged",
          extractionReviewAcknowledged ? "true" : "false",
        );
        if (dirty) {
          const saved = await updateDraftAction({}, reviewForm);
          if (saved.error) throw new Error(saved.error);
        }
        const state = await refreshStudio();
        const approved = await approveStudioPublication(
          courseId,
          state.draft.revisionTag,
          extractionReviewAcknowledged,
        );
        if (!approved.ok) throw new Error(approved.error);
        setIsInstructorReviewed(true);
        const prepared = await prepareStudio(courseId, state.draft.revisionTag);
        setSourceState(prepared);
        const publishForm = new FormData();
        publishForm.set("courseId", courseId);
        publishForm.set("expectedRevisionTag", state.draft.revisionTag);
        const publishedRevision = await publishRevisionAction({}, publishForm);
        if (publishedRevision.error) throw new Error(publishedRevision.error);
        setPublished(
          publishedRevision.publishedRevisionTag || state.draft.revisionTag,
        );
        setStep(3);
        setSuccessMsg("Course published. Students can now open this revision.");
      } catch (error) {
        setErrorMsg(
          error instanceof Error ? error.message : "Review and publish failed",
        );
      }
    });
  };

  const handleGenerateProposal = (objective: DraftLearningObjective) => {
    const serial = ++generationSerial.current,
      requestKey = generationKey;
    setActiveObjective(objective);
    setActivityProposal(null);
    setCandidateReviewed(false);
    setRegistrationSuccess(null);
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const candidate = await generateCandidateActivity(
          courseId,
          objective.id,
          selectedActivityType,
          `${objective.statement || objective.text || "Objective"} Check`,
          undefined,
          draft.revisionTag,
          sourceChunkId || undefined,
          {
            language: generationLanguage,
            difficulty: generationDifficulty,
            hintDepth,
            sourceSectionId: sourceSectionId || undefined,
          },
        );
        if (serial !== generationSerial.current) return;
        if (latestGenerationKey.current !== requestKey) {
          setErrorMsg(
            "Candidate discarded because the draft or generation settings changed. Generate again after saving.",
          );
          return;
        }
        setActivityProposal(candidate);
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Failed to generate activity candidate proposal.",
        );
      }
    });
  };

  const handleRegisterActivity = () => {
    if (
      !activityProposal ||
      dirty ||
      activityProposal.draftRevisionTag !== draft.revisionTag
    )
      return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const act = activityProposal.candidateActivity;
        const ev = activityProposal.candidateEvaluation;
        const res = await registerCandidateActivity(
          courseId,
          String(act.activityId),
          act,
          ev,
        );
        await refreshStudio();
        setRegistrationSuccess(
          `Activity registered! ID: ${res.activityId} (Revision: ${res.revisionId})`,
        );
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Failed to register candidate activity.",
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header status bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-xl font-bold tracking-tight sm:text-2xl">
              {courseTitle}
            </h1>
            <Badge
              variant={draft.status === "published" ? "default" : "outline"}
            >
              {draft.status === "published" || hasPublishedRevision || published
                ? "Published"
                : "Not published yet"}
            </Badge>
            {isInstructorReviewed ? (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-600"
              >
                Checked
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-amber-500/10 text-amber-600"
              >
                Not checked yet
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            EdNova reads your material and turns it into chapters and lessons.
            Check them, then publish so learners can start.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save changes"}
          </Button>
          <Button
            onClick={handlePrepareAndPublish}
            disabled={
              isPending || !!published || !topics.length || !sourceState
            }
            title={
              sourceState?.extractionReview?.required &&
              !extractionReviewAcknowledged &&
              !sourceState.extractionReview.acknowledged
                ? "Confirm the source review below before publishing"
                : "Review the current edit, verify the exact source and publish it"
            }
          >
            {isPending ? "Preparing…" : "Publish course"}
          </Button>
        </div>
      </div>

      {topics.length > 0 && (
        <section
          aria-label="Automatic review and publishing"
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4"
        >
          <div
            role="status"
            aria-live="polite"
            className="min-w-0 flex-1 text-sm"
          >
            <p className="font-medium">
              {auto.phase === "checking"
                ? "Checking the draft…"
                : auto.phase === "fixing"
                  ? "Improving unclear titles and objectives…"
                  : auto.phase === "publishing"
                    ? "Publishing…"
                    : auto.phase === "published"
                      ? "Published"
                      : auto.phase === "held"
                        ? "Waiting for you"
                        : autoEnabled
                          ? "Automatic review is on"
                          : "Automatic review is off"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {auto.message ??
                "EdNova checks this draft, fixes unclear lesson titles and objectives, and publishes when nothing blocks it. Source regions with low confidence always wait for your confirmation."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(event) => {
                  setAutoEnabled(event.target.checked);
                  try {
                    if (event.target.checked) localStorage.setItem(AUTO_KEY, "on");
                    else localStorage.removeItem(AUTO_KEY);
                  } catch {
                    /* ignore */
                  }
                }}
              />
              Review and publish automatically
            </label>
            {!published &&
              auto.phase !== "checking" &&
              auto.phase !== "fixing" &&
              auto.phase !== "publishing" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending || dirty}
                  onClick={() => {
                    autoRan.current = draft.revisionTag;
                    void runAuto();
                  }}
                >
                  Review and publish now
                </Button>
              )}
          </div>
        </section>
      )}
      <ol
        aria-label="Course review progress"
        className="grid gap-3 sm:grid-cols-3"
      >
        {[
          [1, "Add material", "Your PDF or notes"],
          [2, "Check", "Chapters and what each lesson teaches"],
          [3, "Publish", "Make it available to learners"],
        ].map(([number, title, description]) => (
          <li
            key={number}
            aria-current={step === number ? "step" : undefined}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              step === number
                ? "border-primary/40 bg-primary/5"
                : step > Number(number)
                  ? "bg-muted/30"
                  : "bg-card text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                step >= Number(number)
                  ? "bg-primary text-primary-foreground"
                  : "border",
              )}
            >
              {number}
            </span>
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-0.5 block text-xs">{description}</span>
            </span>
          </li>
        ))}
      </ol>

      {dirty && (
        <p role="status">
          You have changes that are not saved yet. Publishing saves them too.
        </p>
      )}
      {originalFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          <span className="text-sm font-medium">Original material</span>
          {originalFiles.map((file) => (
            <a
              key={file.filename}
              className="text-sm underline underline-offset-4"
              href={`/api/v1/study/courses/${encodeURIComponent(courseId)}/files/${encodeURIComponent(file.filename)}?inline=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {file.originalName || file.filename}
            </a>
          ))}
        </div>
      )}
      {!!sourceState?.extractionReview?.required && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">
            {sourceState.extractionReview.reviewRegionCount} place
            {sourceState.extractionReview.reviewRegionCount === 1
              ? ""
              : "s"}{" "}
            where the text may not match your original
          </p>
          <a
            className="mt-2 inline-block text-sm underline"
            href="#source-review"
            onClick={() => {
              const inspector = document.getElementById(
                "source-review",
              ) as HTMLDetailsElement | null;
              if (inspector) inspector.open = true;
            }}
          >
            Show me where
          </a>
          <p className="mt-1 text-xs text-muted-foreground">
            The reader was not sure about these, usually formulas, tables or
            scanned pages. Open your original file and compare them before you
            confirm.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={extractionReviewAcknowledged}
              onChange={(event) => {
                setExtractionReviewAcknowledged(event.target.checked);
              }}
              className="mt-0.5 size-4 rounded border-gray-300"
            />
            <span>I compared these places with my original file.</span>
          </label>
        </div>
      )}
      {/* Global Alerts */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
          {/stale|changed|conflict|reload/i.test(errorMsg) && (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await refreshStudio();
                    setActivityProposal(null);
                    setSourceChunkId("");
                    setCandidateReviewed(false);
                    setErrorMsg(null);
                  } catch (error) {
                    setErrorMsg(
                      error instanceof Error ? error.message : "Reload failed",
                    );
                  }
                });
              }}
            >
              Load latest draft and discard local edits
            </Button>
          )}
        </Alert>
      )}
      {successMsg && (
        <Alert className="border-emerald-500 text-emerald-700">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {published && (
        <div className="flex flex-wrap gap-4">
          <a
            className="underline"
            href={`/courses/${courseId}/learn?revisionId=${encodeURIComponent(published)}`}
          >
            Open the published course as a learner
          </a>
          <a className="underline" href={`/courses/${courseId}/students`}>
            Next: invite students
          </a>
        </div>
      )}
      <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer font-medium">
          Check individual equations (optional)
        </summary>
        <div className="mt-4">
          <FormulaReview
            courseId={courseId}
            revisionTag={draft.revisionTag}
            disabled={dirty || isPending || !!published}
          />
        </div>
      </details>
      <details id="source-review" className="rounded-xl border bg-card">
        <summary className="cursor-pointer px-6 py-4 text-sm font-semibold">
          Advanced tools: source check and extra activities
        </summary>
        <div className="border-t px-6 pb-6">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>Upload a source</CardTitle>
              <CardDescription>
                The Studio reads the course and builds chapters and lessons.
                Large documents may take a minute.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  setErrorMsg(null);
                  startTransition(async () => {
                    try {
                      await uploadStudioSource(courseId, form);
                      setIngestion("Reading the source…");
                      setIngestionStatus({ status: "processing" });
                      setStep(1);
                      setSourceState(null);
                      setActivityProposal(null);
                    } catch (e) {
                      setErrorMsg(
                        e instanceof Error ? e.message : "Upload failed",
                      );
                    }
                  });
                }}
              >
                <label className="block text-sm font-medium">
                  Original source{" "}
                  <input
                    name="files"
                    type="file"
                    accept=".pdf,.txt,.md"
                    required
                    className="mt-2 block w-full rounded-lg border bg-background p-2 text-sm"
                  />
                </label>
                <Button disabled={isPending} className="mt-3">
                  {isPending ? "Uploading…" : "Upload source"}
                </Button>
              </form>
              <p role="status" className="text-sm text-muted-foreground">
                {ingestion}
              </p>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Advanced: verify source and recover an interrupted upload
                </summary>
                <Button
                  variant="outline"
                  className="mt-3 w-full sm:w-auto"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const status = await studioIngestStatus(courseId);
                        setIngestionStatus(status);
                        setIngestion(
                          [status.stage, status.detail]
                            .filter(Boolean)
                            .join(" · ") || "No ingestion details",
                        );
                        if (status.status === "completed")
                          await refreshStudio();
                      } catch (e) {
                        setErrorMsg(
                          e instanceof Error ? e.message : "Status unavailable",
                        );
                      }
                    })
                  }
                >
                  Check processing status
                </Button>
                {typeof ingestionStatus?.jobId === "string" && (
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Ingestion recovery controls"
                  >
                    {(["reconcile", "retry", "cancel"] as const).map(
                      (action) => (
                        <Button
                          key={action}
                          variant="outline"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              try {
                                await controlStudioIngestion(
                                  courseId,
                                  action,
                                  String(ingestionStatus.jobId),
                                );
                                const status =
                                  await studioIngestStatus(courseId);
                                setIngestionStatus(status);
                                setIngestion(
                                  String(status.status) +
                                    ": " +
                                    String(status.detail || ""),
                                );
                              } catch (e) {
                                setErrorMsg(
                                  e instanceof Error
                                    ? e.message
                                    : "Recovery unavailable",
                                );
                              }
                            })
                          }
                        >
                          {action === "reconcile"
                            ? "Reconcile same operation"
                            : action === "retry"
                              ? "Retry failed ingestion"
                              : "Cancel ingestion"}
                        </Button>
                      ),
                    )}
                  </div>
                )}

                <Button
                  className="mt-3"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      setErrorMsg(null);
                      try {
                        const state = await prepareStudio(
                          courseId,
                          draft.revisionTag,
                        );
                        setSourceState(state);
                        setSuccessMsg(
                          "Exact source revision prepared and verified.",
                        );
                      } catch (e) {
                        setSourceState(null);
                        setErrorMsg(
                          e instanceof Error
                            ? e.message
                            : "Source preparation unavailable",
                        );
                      }
                    })
                  }
                >
                  Prepare exact source revision
                </Button>
                <p>
                  {sourceState?.readiness || "Source readiness unavailable"}
                </p>
                <label className="block">
                  Source passage
                  <span className="block text-xs text-muted-foreground">
                    {sourceState?.sources.length || 0} extracted regions ·
                    choose one to inspect
                  </span>
                  <select
                    aria-label="Source passage"
                    className="block w-full border p-2"
                    value={sourceChunkId}
                    onChange={(e) => {
                      setSourceChunkId(e.target.value);
                      setActivityProposal(null);
                      setCandidateReviewed(false);
                    }}
                  >
                    <option value="">Choose a passage to inspect</option>
                    {sourceState?.sources.map((p) => (
                      <option key={p.chunkId} value={p.chunkId}>
                        {p.pageNumber ? "Page " + p.pageNumber : "Text"}:{" "}
                        {p.text.replace(/\s+/g, " ").slice(0, 100)}
                      </option>
                    ))}
                  </select>
                </label>
                {sourceState?.sources
                  .filter((p) => p.chunkId === sourceChunkId)
                  .map((p) => (
                    <div key={p.chunkId}>
                      {p.reviewRequired && (
                        <p role="status" className="text-sm text-amber-700">
                          This passage needs comparison with the original
                          source.
                        </p>
                      )}
                      {p.extractionMethod === "ocr" && (
                        <p role="status">
                          Scanned page: English OCR confidence{" "}
                          {p.ocrConfidence ?? "unknown"}%.
                          {p.extractionWarning === "ocr_low_confidence"
                            ? " Low confidence."
                            : ""}{" "}
                          Check the original and correct the draft before
                          publication.
                        </p>
                      )}
                      <blockquote className="max-h-72 overflow-auto rounded-lg border bg-muted/20 p-4 whitespace-pre-wrap">
                        {p.text}
                      </blockquote>
                    </div>
                  ))}
                {!sourceChunkId && (
                  <p className="text-sm text-muted-foreground">
                    Passage text is loaded only for the passage you select. Keep
                    the original PDF open when checking equations, figures or
                    tables.
                  </p>
                )}
                <p>
                  Registered in this draft:{" "}
                  {sourceState?.activities.map((a) => a.title).join(", ") ||
                    "None"}
                </p>
              </details>
            </CardContent>
          </Card>
        </div>
      </details>
      {topics.length > 0 && (
        <CourseReviewPanel
          courseId={courseId}
          dirty={dirty}
          onApply={applyReviewProposal}
        />
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  Review the course outline
                </CardTitle>
                <CardDescription>
                  Check the chapter structure and the lessons that will become
                  the student journey.
                </CardDescription>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {topics.length} chapters
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {topics.reduce(
                    (count, topic) => count + (topic.subtopics?.length || 0),
                    0,
                  )}{" "}
                  lessons
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Course summary
                </span>
                <Textarea
                  id="draft-summary"
                  value={summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    setDirty(true);
                    setIsInstructorReviewed(false);
                    setActivityProposal(null);
                  }}
                  rows={2}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
              <label className="min-w-0 flex-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Add an objective to the selected lesson
                </span>
                <Input
                  aria-label="Manual learning objective"
                  value={manualObjective}
                  onChange={(e) => setManualObjective(e.target.value)}
                  placeholder="What should students be able to do?"
                  className="mt-1 bg-background"
                />
              </label>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={
                  !manualObjective.trim() ||
                  !topics[selectedChapter]?.subtopics?.length
                }
                onClick={() => {
                  const suffix = crypto
                    .randomUUID()
                    .replace(/-/g, "")
                    .slice(0, 12);
                  setDirty(true);
                  setIsInstructorReviewed(false);
                  const lessonIndex = selectedLesson >= 0 ? selectedLesson : 0;
                  setTopics(
                    topics.map((topic, index) =>
                      index !== selectedChapter
                        ? topic
                        : {
                            ...topic,
                            subtopics: topic.subtopics?.map((lesson, index) =>
                              index !== lessonIndex
                                ? lesson
                                : {
                                    ...lesson,
                                    learning_objectives: [
                                      ...(lesson.learning_objectives || []),
                                      {
                                        id: "obj_" + suffix,
                                        statement: manualObjective.trim(),
                                        text: manualObjective.trim(),
                                        bloomLevel: "understand",
                                        provenance: "manual",
                                      },
                                    ],
                                  },
                            ),
                          },
                    ),
                  );
                  setSelectedLesson(lessonIndex);
                  setShowAllLessons(false);
                  setManualObjective("");
                  setActivityProposal(null);
                }}
              >
                Add learning objective
              </Button>
            </div>

            <nav
              aria-label="Chapters"
              className="grid grid-cols-2 gap-2 sm:flex sm:snap-x sm:overflow-x-auto sm:pb-1"
            >
              {topics.map((topic, index) => (
                <button
                  key={topic.id || index}
                  type="button"
                  aria-current={selectedChapter === index ? "true" : undefined}
                  onClick={() => {
                    setSelectedChapter(index);
                    setSelectedLesson(0);
                    setShowAllLessons(false);
                  }}
                  className={cn(
                    "min-w-0 snap-start rounded-lg border px-3 py-2 text-left transition-colors sm:min-w-44",
                    selectedChapter === index
                      ? "border-primary/40 bg-primary/5"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Chapter {index + 1}
                  </span>
                  <span className="line-clamp-2 text-sm font-medium">
                    {topic.title.replace(/^Chapter \d+:\s*/i, "")}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {topic.subtopics?.length || 0} lessons
                  </span>
                </button>
              ))}
            </nav>

            {topics.map((topic, tIdx) =>
              tIdx !== selectedChapter ? null : (
                <section key={topic.id || tIdx} className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Chapter {tIdx + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">
                        {topic.title.replace(/^Chapter \d+:\s*/i, "")}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={tIdx === 0}
                        aria-label={`Move topic ${tIdx + 1} up`}
                        onClick={() => {
                          const reordered = [...topics];
                          [reordered[tIdx - 1], reordered[tIdx]] = [
                            reordered[tIdx],
                            reordered[tIdx - 1],
                          ];
                          setTopics(reordered);
                          setSelectedChapter(tIdx - 1);
                          setSelectedLesson(0);
                          setDirty(true);
                          setIsInstructorReviewed(false);
                          setActivityProposal(null);
                        }}
                      >
                        Move up
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={tIdx === topics.length - 1}
                        aria-label={`Move topic ${tIdx + 1} down`}
                        onClick={() => {
                          const reordered = [...topics];
                          [reordered[tIdx + 1], reordered[tIdx]] = [
                            reordered[tIdx],
                            reordered[tIdx + 1],
                          ];
                          setTopics(reordered);
                          setSelectedChapter(tIdx + 1);
                          setSelectedLesson(0);
                          setDirty(true);
                          setIsInstructorReviewed(false);
                          setActivityProposal(null);
                        }}
                      >
                        Move down
                      </Button>
                    </div>
                  </div>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Topic heading {tIdx + 1}
                    </span>
                    <Input
                      aria-label={`Topic heading ${tIdx + 1}`}
                      value={topic.title}
                      onChange={(e) => {
                        setTopics(
                          topics.map((candidate, index) =>
                            index === tIdx
                              ? { ...candidate, title: e.target.value }
                              : candidate,
                          ),
                        );
                        setDirty(true);
                        setIsInstructorReviewed(false);
                        setActivityProposal(null);
                      }}
                    />
                  </label>

                  <div className="divide-y rounded-lg border">
                    {(showAllLessons
                      ? topic.subtopics || []
                      : (topic.subtopics || []).slice(0, LESSONS_PER_PAGE)
                    ).map((sub, sIdx) => {
                      const isOpen = selectedLesson === sIdx;
                      return (
                        <div key={sub.id || sIdx}>
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() =>
                              setSelectedLesson(isOpen ? -1 : sIdx)
                            }
                            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left hover:bg-muted/40"
                          >
                            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {sIdx + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {sub.title}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {sub.learning_objectives?.length || 0}{" "}
                                {sub.learning_objectives?.length === 1
                                  ? "objective"
                                  : "objectives"}
                              </span>
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {isOpen ? "Close" : "Review"}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="space-y-4 border-t bg-muted/20 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {sub.provenance || "extracted"}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  Lesson {sIdx + 1} of{" "}
                                  {topic.subtopics?.length || 0}
                                </p>
                              </div>
                              {sub.summary && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">
                                    Extracted lesson preview
                                  </p>
                                  <p className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-sm leading-relaxed">
                                    {sub.summary}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Compare this extraction with the original
                                    material above. Equations may need the
                                    original image to be readable.
                                  </p>
                                </div>
                              )}
                              <label className="grid gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Section heading {tIdx + 1}.{sIdx + 1}
                                </span>
                                <Input
                                  aria-label={`Section heading ${tIdx + 1}.${sIdx + 1}`}
                                  value={sub.title}
                                  onChange={(e) => {
                                    setTopics(
                                      topics.map((candidate, index) =>
                                        index === tIdx
                                          ? {
                                              ...candidate,
                                              subtopics:
                                                candidate.subtopics?.map(
                                                  (lesson, lessonIndex) =>
                                                    lessonIndex === sIdx
                                                      ? {
                                                          ...lesson,
                                                          title: e.target.value,
                                                          provenance: "manual",
                                                        }
                                                      : lesson,
                                                ),
                                            }
                                          : candidate,
                                      ),
                                    );
                                    setDirty(true);
                                    setIsInstructorReviewed(false);
                                    setActivityProposal(null);
                                  }}
                                />
                              </label>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Learning objectives
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Review before publishing
                                  </span>
                                </div>
                                {sub.learning_objectives?.map((obj, oIdx) => (
                                  <div
                                    key={obj.id || oIdx}
                                    className="rounded-lg border bg-background p-3"
                                  >
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                      <Badge
                                        variant="secondary"
                                        className="font-mono text-xs uppercase"
                                      >
                                        Bloom: {obj.bloomLevel}
                                      </Badge>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleGenerateProposal(obj)
                                        }
                                        disabled={
                                          isPending ||
                                          dirty ||
                                          !sourceState?.ready ||
                                          !sourceChunkId
                                        }
                                      >
                                        Generate Proposal
                                      </Button>
                                    </div>
                                    <Input
                                      aria-label={`Learning objective ${tIdx + 1}.${sIdx + 1}.${oIdx + 1}`}
                                      value={obj.text || obj.statement || ""}
                                      onChange={(e) =>
                                        handleObjectiveTextChange(
                                          tIdx,
                                          sIdx,
                                          oIdx,
                                          e.target.value,
                                        )
                                      }
                                      className="text-sm"
                                    />
                                  </div>
                                ))}
                                {!sub.learning_objectives?.length && (
                                  <p className="text-sm text-muted-foreground">
                                    No learning objective was found. Add one
                                    above to make this lesson ready to review.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {(topic.subtopics?.length || 0) > LESSONS_PER_PAGE && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="self-start"
                      onClick={() => setShowAllLessons((value) => !value)}
                    >
                      {showAllLessons
                        ? `Show first ${LESSONS_PER_PAGE} lessons`
                        : `Show all ${topic.subtopics?.length} lessons`}
                    </Button>
                  )}
                </section>
              ),
            )}
          </CardContent>
        </Card>

        {/* Optional practice remains a side panel, not a second full workflow. */}
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
            Build student practice (optional)
          </summary>
          <div className="border-t px-5 pb-5">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">Add student practice</CardTitle>
                <CardDescription>
                  Optional: choose an objective to draft a source-backed
                  practice activity. Review it before adding it to the course.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Activity Proposal Studio · Source review remains separate from
                  the draft.
                </p>
                {isPending && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      generationSerial.current += 1;
                      setActivityProposal(null);
                      setCandidateReviewed(false);
                    }}
                  >
                    Discard pending candidate
                  </Button>
                )}
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Settings
                  </summary>
                  <fieldset
                    className="mt-3 grid gap-3"
                    onChange={() => {
                      setActivityProposal(null);
                      setCandidateReviewed(false);
                    }}
                  >
                    <legend>Offline quotation settings</legend>
                    <label>
                      Prompt language
                      <select
                        aria-label="Prompt language"
                        value={generationLanguage}
                        onChange={(e) =>
                          setGenerationLanguage(
                            e.target.value as typeof generationLanguage,
                          )
                        }
                        className="block w-full border p-2"
                      >
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="ar">العربية</option>
                        <option value="ary">تونسي</option>
                      </select>
                    </label>
                    <label>
                      Quotation difficulty
                      <select
                        aria-label="Quotation difficulty"
                        value={generationDifficulty}
                        onChange={(e) =>
                          setGenerationDifficulty(
                            e.target.value as typeof generationDifficulty,
                          )
                        }
                        className="block w-full border p-2"
                      >
                        <option value="beginner">
                          Beginner: 2 choices / 1 blank
                        </option>
                        <option value="standard">
                          Standard: 4 choices / 2 blanks
                        </option>
                        <option value="advanced">
                          Advanced: 6 choices / 3 blanks
                        </option>
                      </select>
                    </label>
                    <label>
                      Hint depth
                      <select
                        aria-label="Hint depth"
                        value={hintDepth}
                        onChange={(e) =>
                          setHintDepth(e.target.value as typeof hintDepth)
                        }
                        className="block w-full border p-2"
                      >
                        <option value="none">No cue</option>
                        <option value="cue">First letter</option>
                        <option value="context">
                          First letter and word length
                        </option>
                      </select>
                    </label>
                    <p className="text-sm">
                      Source quotations remain in their original language.
                      Prompt translations need human review. Difficulty changes
                      quotation complexity, not an academic level estimate.
                    </p>
                  </fieldset>
                </details>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">Activity type</span>
                  <Button
                    size="sm"
                    variant={
                      selectedActivityType === "InteractiveQuiz"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => {
                      setSelectedActivityType("InteractiveQuiz");
                      setActivityProposal(null);
                      setCandidateReviewed(false);
                    }}
                  >
                    InteractiveQuiz
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedActivityType === "GuidedProblem"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => {
                      setSelectedActivityType("GuidedProblem");
                      setActivityProposal(null);
                      setCandidateReviewed(false);
                    }}
                  >
                    GuidedProblem
                  </Button>
                </div>

                {activeObjective ? (
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Target Objective:
                    </span>
                    <p className="mt-1 text-sm font-medium">
                      {activeObjective.statement || activeObjective.text}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    Select &quot;Generate Proposal&quot; on any learning
                    objective on the left.
                  </p>
                )}

                {registrationSuccess && (
                  <Alert className="border-emerald-500 text-emerald-700">
                    <AlertTitle>Registered</AlertTitle>
                    <AlertDescription>{registrationSuccess}</AlertDescription>
                  </Alert>
                )}

                {activityProposal && (
                  <div className="flex flex-col gap-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">
                        Candidate Preview
                      </h4>
                      <Button
                        size="sm"
                        onClick={handleRegisterActivity}
                        disabled={
                          isPending ||
                          dirty ||
                          !candidateReviewed ||
                          activityProposal.draftRevisionTag !==
                            draft.revisionTag
                        }
                      >
                        {isPending ? "Registering..." : "Approve & Register"}
                      </Button>
                    </div>

                    <p>
                      DETERMINISTIC_FALLBACK — quotation completion only. Manual
                      instructor review required.
                    </p>
                    {!!activityProposal.warnings?.length && (
                      <div role="status">
                        <p>
                          Review flags: {activityProposal.warnings.join(", ")}
                        </p>
                        <p>
                          Exact quotation support only; conceptual alignment to
                          the objective is unverified. Unknown source locations
                          remain unknown.
                        </p>
                      </div>
                    )}
                    {activityProposal.evidencePreview && (
                      <details>
                        <summary>Candidate source evidence</summary>
                        <p>
                          {activityProposal.evidencePreview.sectionId} ·{" "}
                          {activityProposal.evidencePreview.pageNumber
                            ? `Page ${activityProposal.evidencePreview.pageNumber}`
                            : "Location unknown"}
                        </p>
                        <blockquote className="whitespace-pre-wrap">
                          {activityProposal.evidencePreview.text}
                        </blockquote>
                      </details>
                    )}
                    <label>
                      Candidate title
                      <Input
                        aria-label="Candidate title"
                        value={String(
                          activityProposal.candidateActivity.title || "",
                        )}
                        onChange={(e) => {
                          setCandidateReviewed(false);
                          setActivityProposal({
                            ...activityProposal,
                            candidateActivity: {
                              ...activityProposal.candidateActivity,
                              title: e.target.value,
                            },
                          });
                        }}
                      />
                    </label>
                    <label>
                      Candidate instructions
                      <Textarea
                        aria-label="Candidate instructions"
                        value={String(
                          activityProposal.candidateActivity.instructions || "",
                        )}
                        onChange={(e) => {
                          setCandidateReviewed(false);
                          setActivityProposal({
                            ...activityProposal,
                            candidateActivity: {
                              ...activityProposal.candidateActivity,
                              instructions: e.target.value,
                            },
                          });
                        }}
                      />
                    </label>
                    <details>
                      <summary>
                        Private instructor evaluation definition
                      </summary>
                      <pre className="overflow-auto text-xs">
                        {JSON.stringify(
                          activityProposal.candidateEvaluation,
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                    <label className="block">
                      <input
                        type="checkbox"
                        checked={candidateReviewed}
                        onChange={(e) => setCandidateReviewed(e.target.checked)}
                      />{" "}
                      I reviewed the source, candidate and private evaluation
                      key.
                    </label>
                    {/* Trusted Renderer in Preview Mode */}
                    <ActivityRenderer
                      activity={
                        activityProposal.candidateActivity as unknown as ActivityDefinition
                      }
                      authenticatedUserId={currentUserId}
                      mode="preview"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </details>
      </div>
    </div>
  );
}
