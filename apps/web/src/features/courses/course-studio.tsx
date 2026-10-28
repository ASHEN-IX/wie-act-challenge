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
} from "./studio-actions";

interface CourseStudioProps {
  courseId: string;
  courseTitle: string;
  initialDraft: CourseDraft;
  currentUserId: string;
}

export function CourseStudio({
  courseId,
  courseTitle,
  initialDraft,
  currentUserId,
}: CourseStudioProps) {
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [sourceState, setSourceState] = useState<Awaited<
    ReturnType<typeof loadStudio>
  > | null>(null);
  const [sourceChunkId, setSourceChunkId] = useState("");
  const [sourceSectionId, setSourceSectionId] = useState("");
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
  const [ingestion, setIngestion] = useState("No upload requested.");
  const [candidateReviewed, setCandidateReviewed] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  useEffect(() => {
    loadStudio(courseId)
      .then(setSourceState)
      .catch((e) => setErrorMsg(e.message));
  }, [courseId]);
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
  const [summary, setSummary] = useState(initialDraft.summary || "");
  const [isInstructorReviewed, setIsInstructorReviewed] = useState(
    initialDraft.isInstructorReviewed,
  );

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

  const handlePublishRevision = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("courseId", courseId);
      form.set("expectedRevisionTag", draft.revisionTag);

      const res = await publishRevisionAction({}, form);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setPublished(draft.revisionTag);
        setSuccessMsg(
          res.success || "Course revision published for student access.",
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Course Studio: {courseTitle}
            </h1>
            <Badge
              variant={draft.status === "published" ? "default" : "outline"}
            >
              {draft.status}
            </Badge>
            {isInstructorReviewed ? (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-600"
              >
                Reviewed
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-amber-500/10 text-amber-600"
              >
                Needs Review
              </Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Revision: {draft.revisionTag} | Content Hash:{" "}
            {draft.contentHash?.slice(0, 18)}...
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={handlePublishRevision}
            disabled={
              isPending ||
              dirty ||
              !isInstructorReviewed ||
              !sourceState?.ready ||
              !!published
            }
            title={
              !isInstructorReviewed
                ? "Mark draft as reviewed before publishing"
                : "Publish revision to learners"
            }
          >
            {isPending ? "Publishing..." : "Publish Revision"}
          </Button>
        </div>
      </div>

      {dirty && (
        <p role="status">
          Unsaved changes. Save the draft, then prepare its exact revision.
        </p>
      )}
      {/* Global Alerts */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Action Failed</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
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
        </Alert>
      )}
      {successMsg && (
        <Alert className="border-emerald-500 text-emerald-700">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {published && (
        <a
          className="underline"
          href={`/courses/${courseId}/learn?revisionId=${encodeURIComponent(published)}`}
        >
          Open committed immutable revision
        </a>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Source preparation</CardTitle>
          <CardDescription>
            Upload original bytes, inspect worker progress, then explicitly
            prepare the current reviewed revision. Saving curriculum changes
            invalidates readiness.
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
                  setIngestion(
                    "Upload acknowledged; worker extraction pending. Refresh progress.",
                  );
                  setSourceState(null);
                  setActivityProposal(null);
                } catch (e) {
                  setErrorMsg(e instanceof Error ? e.message : "Upload failed");
                }
              });
            }}
          >
            <label>
              Original source{" "}
              <input name="files" type="file" accept=".pdf,.txt,.md" required />
            </label>
            <Button disabled={isPending}>Upload source</Button>
          </form>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const status = await studioIngestStatus(courseId);
                  setIngestionStatus(status);
                  setIngestion(JSON.stringify(status));
                  await refreshStudio();
                } catch (e) {
                  setErrorMsg(
                    e instanceof Error
                      ? e.message
                      : "Worker status unavailable",
                  );
                }
              })
            }
          >
            Refresh ingestion and draft
          </Button>
          <p role="status">{ingestion}</p>
          {typeof ingestionStatus?.jobId === "string" && (
            <div
              className="flex flex-wrap gap-2"
              aria-label="Ingestion recovery controls"
            >
              {(["reconcile", "retry", "cancel"] as const).map((action) => (
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
                        const status = await studioIngestStatus(courseId);
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
              ))}
            </div>
          )}

          <Button
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
                  setSuccessMsg("Exact source revision prepared and verified.");
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
          <p>{sourceState?.readiness || "Source readiness unavailable"}</p>
          <label className="block">
            Source section
            <select
              aria-label="Source section"
              className="block w-full border p-2"
              value={sourceSectionId}
              onChange={(e) => {
                setSourceSectionId(e.target.value);
                setSourceChunkId("");
                setActivityProposal(null);
                setCandidateReviewed(false);
              }}
            >
              <option value="">All verified sections</option>
              {[
                ...new Set(
                  sourceState?.sources.map((p) => p.sectionId).filter(Boolean),
                ),
              ].map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Verified source passage{" "}
            <select
              aria-label="Verified source passage"
              className="block w-full border p-2"
              value={sourceChunkId}
              onChange={(e) => {
                setSourceChunkId(e.target.value);
                setActivityProposal(null);
              }}
            >
              <option value="">Select a verified passage</option>
              {sourceState?.sources
                .filter(
                  (p) => !sourceSectionId || p.sectionId === sourceSectionId,
                )
                .map((p) => (
                  <option key={p.chunkId} value={p.chunkId}>
                    {p.pageNumber ? "Page " + p.pageNumber : "Text"}:{" "}
                    {p.text.slice(0, 120)}
                  </option>
                ))}
            </select>
          </label>
          {sourceState?.sources
            .filter((p) => p.chunkId === sourceChunkId)
            .map((p) => (
              <div key={p.chunkId}>
                {p.extractionMethod === "ocr" && (
                  <p role="status">
                    Scanned page: English OCR confidence{" "}
                    {p.ocrConfidence ?? "unknown"}%.
                    {p.extractionWarning === "ocr_low_confidence"
                      ? " Low confidence."
                      : ""}{" "}
                    Check the original and correct the draft before publication.
                  </p>
                )}
                <blockquote className="border-l-2 pl-4 whitespace-pre-wrap">
                  {p.text}
                </blockquote>
              </div>
            ))}
          <p>
            Registered in this draft:{" "}
            {sourceState?.activities.map((a) => a.title).join(", ") || "None"}
          </p>
        </CardContent>
      </Card>
      {/* Grid: Editor & Preview */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Draft Outline and Hierarchy Editor */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Draft Curriculum Hierarchy
              </CardTitle>
              <CardDescription>
                Correct AI-extracted topics, subtopics, and learning objectives.
                Changes remain local until saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div>
                <label
                  htmlFor="draft-summary"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Draft Summary
                </label>
                <Textarea
                  id="draft-summary"
                  value={summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    setDirty(true);
                    setIsInstructorReviewed(false);
                    setActivityProposal(null);
                  }}
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reviewed-checkbox"
                  checked={isInstructorReviewed}
                  onChange={(e) => {
                    setIsInstructorReviewed(e.target.checked);
                    setDirty(true);
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label
                  htmlFor="reviewed-checkbox"
                  className="text-sm font-medium leading-none"
                >
                  Mark this curriculum revision as reviewed by course instructor
                </label>
              </div>

              <label>
                Manual learning objective
                <Input
                  aria-label="Manual learning objective"
                  value={manualObjective}
                  onChange={(e) => setManualObjective(e.target.value)}
                />
              </label>
              <Button
                variant="outline"
                disabled={!manualObjective.trim()}
                onClick={() => {
                  const suffix = crypto
                    .randomUUID()
                    .replace(/-/g, "")
                    .slice(0, 12);
                  setDirty(true);
                  setIsInstructorReviewed(false);
                  setTopics([
                    ...topics,
                    {
                      id: "topic_" + suffix,
                      title: "Instructor reviewed objective",
                      subtopics: [
                        {
                          id: "sub_" + suffix,
                          title: "Source study",
                          provenance: "manual",
                          learning_objectives: [
                            {
                              id: "obj_" + suffix,
                              statement: manualObjective,
                              text: manualObjective,
                              bloomLevel: "understand",
                              provenance: "manual",
                            },
                          ],
                        },
                      ],
                    },
                  ]);
                  setManualObjective("");
                  setActivityProposal(null);
                }}
              >
                Add learning objective
              </Button>
              <div className="flex flex-col gap-6 divide-y">
                {topics.map((topic, tIdx) => (
                  <div key={topic.id || tIdx} className="pt-4 first:pt-0">
                    <h3 className="font-semibold text-foreground">
                      {tIdx + 1}. {topic.title}
                    </h3>
                    <label className="block text-sm">
                      Topic heading {tIdx + 1}
                      <Input
                        aria-label={`Topic heading ${tIdx + 1}`}
                        value={topic.title}
                        onChange={(e) => {
                          setTopics(
                            topics.map((t, index) =>
                              index === tIdx
                                ? { ...t, title: e.target.value }
                                : t,
                            ),
                          );
                          setDirty(true);
                          setIsInstructorReviewed(false);
                          setActivityProposal(null);
                        }}
                      />
                    </label>
                    <div className="flex gap-2 mt-2">
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
                          setDirty(true);
                          setIsInstructorReviewed(false);
                          setActivityProposal(null);
                        }}
                      >
                        Move down
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-col gap-4 pl-4">
                      {topic.subtopics?.map((sub, sIdx) => (
                        <div
                          key={sub.id || sIdx}
                          className="rounded-lg border bg-muted/30 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">
                              {sub.title}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {sub.provenance || "extracted"}
                            </Badge>
                          </div>
                          <label className="block text-sm mt-2">
                            Section heading {tIdx + 1}.{sIdx + 1}
                            <Input
                              aria-label={`Section heading ${tIdx + 1}.${sIdx + 1}`}
                              value={sub.title}
                              onChange={(e) => {
                                setTopics(
                                  topics.map((t, index) =>
                                    index === tIdx
                                      ? {
                                          ...t,
                                          subtopics: t.subtopics?.map(
                                            (s, idx) =>
                                              idx === sIdx
                                                ? {
                                                    ...s,
                                                    title: e.target.value,
                                                    provenance: "manual",
                                                  }
                                                : s,
                                          ),
                                        }
                                      : t,
                                  ),
                                );
                                setDirty(true);
                                setIsInstructorReviewed(false);
                                setActivityProposal(null);
                              }}
                            />
                          </label>

                          {/* Objectives list */}
                          <div className="mt-3 flex flex-col gap-3">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Learning Objectives
                            </span>
                            {sub.learning_objectives?.map((obj, oIdx) => (
                              <div
                                key={obj.id || oIdx}
                                className="flex flex-col gap-2 rounded border bg-background p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-xs uppercase"
                                  >
                                    Bloom: {obj.bloomLevel}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGenerateProposal(obj)}
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
                                  className="text-xs font-medium"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: AI Activity Proposal Generation & Live Preview */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Activity Proposal Studio
              </CardTitle>
              <CardDescription>
                Select an objective to generate source-backed student activities.
                AI cannot publish or change your draft on its own.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
              <fieldset
                className="grid gap-3"
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
                  Source quotations remain in their original language. Prompt
                  translations need human review. Difficulty changes quotation
                  complexity, not an academic level estimate.
                </p>
              </fieldset>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium">Activity Type:</span>
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
                  Select &quot;Generate Proposal&quot; on any learning objective
                  on the left.
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
                    <h4 className="text-sm font-semibold">Candidate Preview</h4>
                    <Button
                      size="sm"
                      onClick={handleRegisterActivity}
                      disabled={
                        isPending ||
                        dirty ||
                        !candidateReviewed ||
                        activityProposal.draftRevisionTag !== draft.revisionTag
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
                    <summary>Private instructor evaluation definition</summary>
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
                    I reviewed the source, candidate and private evaluation key.
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
      </div>
    </div>
  );
}
