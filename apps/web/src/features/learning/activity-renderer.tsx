"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityDefinition } from "@/lib/activity-contracts";

export interface GradedAssessmentView {
  schemaVersion: "1.0.0";
  visibility: "recipient_only";
  userId: string;
  attemptId: string;
  status: "graded";
  score: number;
  isCorrect: boolean;
  feedback: string;
  socraticHint?: string | null;
  recommendedNextStep?: {
    type: "advance";
    nextObjectiveId: string;
    title: string;
  } | null;
  evidenceId?: string | null;
  evaluatedAt: string;
  masteryAchieved?: boolean;
}

export type AssessmentResultView =
  | GradedAssessmentView
  | {
      status: "pending" | "unavailable" | "failed" | "rejected";
      code: string;
      retryable: boolean;
      attemptId: string;
      userId: string;
    };

export interface ActivityRendererProps {
  activity: ActivityDefinition;
  authenticatedUserId: string;
  initialResult?: AssessmentResultView;
  onSubmitAttempt?: (
    answers: Record<string, unknown>,
    timeSpentSeconds: number,
  ) => Promise<AssessmentResultView>;
  mode?: "solo" | "room" | "preview";
}

export function ActivityRenderer({
  activity,
  authenticatedUserId: _authenticatedUserId,
  initialResult,
  onSubmitAttempt,
  mode = "solo",
}: ActivityRendererProps) {
  const ownResult =
    initialResult?.userId === _authenticatedUserId ? initialResult : undefined;
  const privateSubmit = onSubmitAttempt
    ? async (answers: Record<string, unknown>, seconds: number) => {
        const result = await onSubmitAttempt(answers, seconds);
        if (result.userId !== _authenticatedUserId)
          throw new Error("Private recipient mismatch");
        return result;
      }
    : undefined;
  // Allowlist dispatch
  if (activity.activityType === "InteractiveQuiz") {
    return (
      <InteractiveQuizRenderer
        activity={activity}
        initialResult={ownResult}
        onSubmitAttempt={privateSubmit}
        mode={mode}
      />
    );
  }

  if (activity.activityType === "GuidedProblem") {
    return (
      <GuidedProblemRenderer
        activity={activity}
        initialResult={ownResult}
        onSubmitAttempt={privateSubmit}
        mode={mode}
      />
    );
  }

  // Safe fallback for unknown activity types (zero eval/execution)
  return (
    <Card className="w-full max-w-2xl border-destructive">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-destructive">
          Unsupported Activity Type
        </CardTitle>
        <CardDescription>
          This activity cannot be rendered interactively.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {(activity as { instructions?: string }).instructions ||
            "Interactive content unavailable."}
        </p>
      </CardContent>
    </Card>
  );
}

function InteractiveQuizRenderer({
  activity,
  initialResult,
  onSubmitAttempt,
  mode,
}: {
  activity: Extract<ActivityDefinition, { activityType: "InteractiveQuiz" }>;
  initialResult?: AssessmentResultView;
  onSubmitAttempt?: (
    answers: Record<string, unknown>,
    timeSpentSeconds: number,
  ) => Promise<AssessmentResultView>;
  mode: "solo" | "room" | "preview";
}) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResultView | null>(
    initialResult ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const submittedSeconds = useRef<number | null>(null);

  const presentation = activity.presentationData;
  const isMulti = presentation.isMultiSelect;

  const handleSelect = (optionId: string) => {
    if (result || submittedSeconds.current !== null) return; // Retry keeps the original response
    if (isMulti) {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      );
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const handleSubmit = async () => {
    if (selectedOptionIds.length === 0 || !onSubmitAttempt || isSubmitting)
      return;

    setIsSubmitting(true);
    setError(null);
    const timeSpent =
      submittedSeconds.current ??
      Math.max(1, Math.round((Date.now() - startTime) / 1000));
    submittedSeconds.current = timeSpent;

    try {
      const assessment = await onSubmitAttempt(
        { selectedOptionIds },
        timeSpent,
      );
      setResult(assessment);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit attempt.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    submittedSeconds.current = null;
    setSelectedOptionIds([]);
    setResult(null);
    setError(null);
  };

  return (
    <Card className="w-full max-w-2xl shadow-sm" data-testid="quiz-renderer">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">{activity.activityType}</Badge>
          {activity.timeLimitSeconds && (
            <span className="text-xs text-muted-foreground">
              Limit: {Math.round(activity.timeLimitSeconds / 60)} min
            </span>
          )}
        </div>
        <CardTitle className="text-xl font-bold">{activity.title}</CardTitle>
        <CardDescription className="text-sm">
          {activity.instructions}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-md border p-4 bg-muted/40">
          <h3 className="font-medium text-sm text-foreground">
            {presentation.question}
          </h3>
        </div>

        {/* Options list */}
        <div
          className="space-y-2"
          role={isMulti ? "group" : "radiogroup"}
          aria-label={presentation.question}
        >
          {presentation.options.map((opt) => {
            const isSelected = selectedOptionIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role={isMulti ? "checkbox" : "radio"}
                aria-checked={isSelected}
                disabled={
                  Boolean(result) ||
                  submittedSeconds.current !== null ||
                  isSubmitting ||
                  mode === "preview"
                }
                onClick={() => handleSelect(opt.id)}
                className={`w-full text-start p-3.5 rounded-lg border text-sm font-medium transition-colors flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted/50 text-foreground"
                } ${result ? "cursor-default" : "cursor-pointer"}`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <Badge variant="default" className="text-xs">
                    Selected
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Assessment feedback panel (solo mode only - never leaked to room) */}
        {result?.status === "graded" && (
          <div className="space-y-4 pt-4 border-t">
            <Alert variant={result.isCorrect ? "default" : "destructive"}>
              <AlertTitle className="flex items-center gap-2">
                <Badge variant={result.isCorrect ? "default" : "destructive"}>
                  {result.isCorrect ? "Correct" : "Incorrect"}
                </Badge>
                <span>Score: {Math.round(result.score * 100)}%</span>
              </AlertTitle>
              <AlertDescription className="mt-2 text-sm">
                {result.feedback}
              </AlertDescription>
            </Alert>

            {result.socraticHint && (
              <div className="p-3 bg-muted rounded-md border text-sm">
                <p className="font-semibold text-xs text-muted-foreground mb-1">
                  Pedagogical Socratic Hint:
                </p>
                <p>{result.socraticHint}</p>
              </div>
            )}

            {result.recommendedNextStep && (
              <div className="p-3 bg-primary/5 rounded-md border border-primary/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary">
                    Recommended Next Step:
                  </p>
                  <p className="text-sm font-medium">
                    {result.recommendedNextStep.title}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {result && result.status !== "graded" && (
          <Alert>
            <AlertTitle>{result.status}</AlertTitle>
            <AlertDescription>
              No mastery awarded. {result.code} If this persists, ask your
              instructor or presenter for a new reviewed check.
              {result.retryable && (
                <Button variant="outline" onClick={() => setResult(null)}>
                  Retry same submission
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {result?.status === "graded" && (
          <p>
            Evidence:{" "}
            {result.evidenceId
              ? "recorded; see private progress for mastery"
              : "none"}
            . Private feedback.
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between items-center border-t pt-4">
        {mode !== "preview" && (
          <>
            {result && mode !== "room" ? (
              <Button variant="outline" onClick={handleReset} size="sm">
                Try Again
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={
                  !!result || selectedOptionIds.length === 0 || isSubmitting
                }
                size="sm"
              >
                {isSubmitting ? "Submitting..." : "Submit Answer"}
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function GuidedProblemRenderer({
  activity,
  initialResult,
  onSubmitAttempt,
  mode,
}: {
  activity: Extract<ActivityDefinition, { activityType: "GuidedProblem" }>;
  initialResult?: AssessmentResultView;
  onSubmitAttempt?: (
    answers: Record<string, unknown>,
    timeSpentSeconds: number,
  ) => Promise<AssessmentResultView>;
  mode: "solo" | "room" | "preview";
}) {
  const presentation = activity.presentationData;
  const [stepAnswers, setStepAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResultView | null>(
    initialResult ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const submittedSeconds = useRef<number | null>(null);

  const handleStepChange = (stepId: string, text: string) => {
    if (result || submittedSeconds.current !== null) return;
    setStepAnswers((prev) => ({ ...prev, [stepId]: text }));
  };

  const handleSubmit = async () => {
    if (!onSubmitAttempt || isSubmitting) return;

    const formattedSteps = presentation.steps.map((s) => ({
      stepId: s.stepId,
      answer: stepAnswers[s.stepId] || "",
    }));

    setIsSubmitting(true);
    setError(null);
    const timeSpent =
      submittedSeconds.current ??
      Math.max(1, Math.round((Date.now() - startTime) / 1000));
    submittedSeconds.current = timeSpent;

    try {
      const assessment = await onSubmitAttempt(
        { steps: formattedSteps },
        timeSpent,
      );
      setResult(assessment);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit guided attempt.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      className="w-full max-w-2xl shadow-sm"
      data-testid="guided-problem-renderer"
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">Guided Problem</Badge>
          <span className="text-xs text-muted-foreground">
            {presentation.steps.length} Steps
          </span>
        </div>
        <CardTitle className="text-xl font-bold">{activity.title}</CardTitle>
        <CardDescription className="text-sm">
          {activity.instructions}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-md border p-4 bg-muted/30">
          <h3 className="font-semibold text-sm mb-1">Problem Scenario</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {presentation.problem}
          </p>
        </div>

        <div className="space-y-4">
          {presentation.steps.map((step, idx) => (
            <div key={step.stepId} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-primary">
                  Step {idx + 1}
                </span>
              </div>
              <p className="text-sm font-medium">{step.prompt}</p>
              <Textarea
                placeholder="Type your mathematical / conceptual reasoning here..."
                value={stepAnswers[step.stepId] || ""}
                disabled={
                  Boolean(result) ||
                  submittedSeconds.current !== null ||
                  isSubmitting ||
                  mode === "preview"
                }
                onChange={(e) => handleStepChange(step.stepId, e.target.value)}
                rows={3}
                className="text-sm mt-2"
              />
            </div>
          ))}
        </div>

        {result?.status === "graded" && (
          <div className="space-y-3 pt-4 border-t">
            <Alert variant={result.isCorrect ? "default" : "destructive"}>
              <AlertTitle className="flex items-center gap-2">
                <Badge variant={result.isCorrect ? "default" : "destructive"}>
                  {result.isCorrect ? "Completed" : "Needs Work"}
                </Badge>
                <span>Score: {Math.round(result.score * 100)}%</span>
              </AlertTitle>
              <AlertDescription className="mt-2 text-sm">
                {result.feedback}
              </AlertDescription>
            </Alert>
            {result.socraticHint && (
              <div className="p-3 bg-muted rounded-md border text-sm">
                <p className="font-semibold text-xs text-muted-foreground mb-1">
                  Socratic Guidance:
                </p>
                <p>{result.socraticHint}</p>
              </div>
            )}
          </div>
        )}

        {result && result.status !== "graded" && (
          <Alert>
            <AlertTitle>{result.status}</AlertTitle>
            <AlertDescription>
              No mastery awarded. {result.code} If this persists, ask your
              instructor or presenter for a new reviewed check.
              {result.retryable && (
                <Button variant="outline" onClick={() => setResult(null)}>
                  Retry same submission
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {result?.status === "graded" && (
          <p>
            Evidence:{" "}
            {result.evidenceId
              ? "recorded; see private progress for mastery"
              : "none"}
            . Private feedback.
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between items-center border-t pt-4">
        {mode === "solo" && result?.status === "graded" && (
          <Button
            variant="outline"
            onClick={() => {
              setStepAnswers({});
              setResult(null);
              setError(null);
              submittedSeconds.current = null;
            }}
          >
            Try Again
          </Button>
        )}
        {mode !== "preview" && !result && (
          <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
            {isSubmitting ? "Evaluating..." : "Submit Steps for Feedback"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
