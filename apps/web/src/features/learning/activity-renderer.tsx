"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { submitActivityAttempt } from "./actions";

export type ActivityType =
  | "InteractiveQuiz"
  | "GuidedProblem"
  | "StepByStepVisualizer"
  | "ParameterExplorer";

export interface QuizOption {
  id: string;
  label: string;
}

export interface InteractiveQuizData {
  question: string;
  options: QuizOption[];
  isMultiSelect: boolean;
}

export interface GuidedProblemStep {
  stepNumber: number;
  prompt: string;
  hint?: string;
}

export interface GuidedProblemData {
  scenario: string;
  steps: GuidedProblemStep[];
}

export interface VisualizerStep {
  stepIndex: number;
  title: string;
  description: string;
  stateRepresentation: Record<string, unknown>;
}

export interface StepByStepVisualizerData {
  concept: string;
  steps: VisualizerStep[];
}

export interface LearningActivity {
  activityId: string;
  activityType: ActivityType;
  schemaVersion: string;
  courseId: string;
  revisionId: string;
  objectiveId: string;
  title: string;
  instructions: string;
  timeLimitSeconds?: number;
  presentationData: InteractiveQuizData | GuidedProblemData | StepByStepVisualizerData | Record<string, unknown>;
  constraints?: {
    maxAttempts?: number;
    allowCalculator?: boolean;
  };
}

export interface AssessmentResult {
  attemptId: string;
  status: "graded" | "in_review" | "failed";
  score: number;
  isCorrect: boolean;
  feedback: string;
  bloomLevelDemonstrated?: string;
  socraticHint?: string | null;
  recommendedNextStep?: {
    type: "advance" | "remediate" | "retry";
    nextObjectiveId?: string;
    title?: string;
  };
}

export function ActivityRenderer({
  activity,
  onComplete,
}: {
  activity: LearningActivity;
  onComplete?: (result: AssessmentResult) => void;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptionToggle = (optionId: string, isMulti: boolean) => {
    if (result) return;
    if (isMulti) {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        activityId: activity.activityId,
        courseId: activity.courseId,
        revisionId: activity.revisionId,
        timeSpentSeconds: 30,
        answers: {
          selectedOptionIds: selectedOptions,
          completedSteps: currentStepIndex + 1,
        },
      };

      const res = await submitActivityAttempt(payload);
      setResult(res);
      if (onComplete) onComplete(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit attempt");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border-border/80 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 mb-2">
          <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
            {activity.activityType}
          </Badge>
          {activity.timeLimitSeconds && (
            <span className="text-xs text-muted-foreground">
              ⏱ {activity.timeLimitSeconds}s
            </span>
          )}
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">{activity.title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{activity.instructions}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Type 1: InteractiveQuiz */}
        {activity.activityType === "InteractiveQuiz" && (
          <div className="space-y-4">
            <p className="font-medium text-foreground">
              {(activity.presentationData as InteractiveQuizData).question}
            </p>
            <div className="space-y-2">
              {(activity.presentationData as InteractiveQuizData).options.map((opt) => {
                const isSelected = selectedOptions.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      handleOptionToggle(
                        opt.id,
                        (activity.presentationData as InteractiveQuizData).isMultiSelect
                      )
                    }
                    disabled={isSubmitting || !!result}
                    className={`w-full text-left p-3.5 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground text-xs"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && "✓"}
                      </div>
                      <span>{opt.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Type 2: GuidedProblem */}
        {activity.activityType === "GuidedProblem" && (
          <div className="space-y-4">
            <div className="p-3 bg-muted/30 rounded-lg border border-border/60 text-sm">
              {(activity.presentationData as GuidedProblemData).scenario}
            </div>
            <div className="space-y-3">
              {(activity.presentationData as GuidedProblemData).steps.map((step, idx) => (
                <div
                  key={step.stepNumber}
                  className={`p-3 rounded-lg border text-sm ${
                    idx === currentStepIndex
                      ? "border-primary/60 bg-primary/5"
                      : idx < currentStepIndex
                      ? "border-border/40 opacity-70 bg-muted/20"
                      : "border-border/20 opacity-40"
                  }`}
                >
                  <div className="font-semibold mb-1">
                    Step {step.stepNumber}: {step.prompt}
                  </div>
                  {step.hint && idx === currentStepIndex && (
                    <div className="text-xs text-muted-foreground mt-2 italic">
                      💡 Socratic Hint: {step.hint}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type 3: StepByStepVisualizer */}
        {activity.activityType === "StepByStepVisualizer" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Concept: {(activity.presentationData as StepByStepVisualizerData).concept}</span>
              <span>
                Step {currentStepIndex + 1} of{" "}
                {(activity.presentationData as StepByStepVisualizerData).steps.length}
              </span>
            </div>
            {(() => {
              const currentStep = (
                activity.presentationData as StepByStepVisualizerData
              ).steps[currentStepIndex];
              return (
                <div className="p-4 bg-muted/40 rounded-lg border border-border space-y-3">
                  <h4 className="font-bold text-sm text-foreground">{currentStep.title}</h4>
                  <p className="text-xs text-muted-foreground">{currentStep.description}</p>
                  <pre className="p-3 bg-background rounded border text-xs overflow-x-auto font-mono">
                    {JSON.stringify(currentStep.stateRepresentation, null, 2)}
                  </pre>
                </div>
              );
            })()}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  currentStepIndex >=
                  (activity.presentationData as StepByStepVisualizerData).steps.length - 1
                }
                onClick={() => setCurrentStepIndex((prev) => prev + 1)}
              >
                Next Step
              </Button>
            </div>
          </div>
        )}

        {/* Results & Socratic Feedback (Contract 06) */}
        {result && (
          <Alert variant={result.isCorrect ? "default" : "destructive"} className="mt-4">
            <AlertTitle className="font-bold flex items-center justify-between">
              <span>{result.isCorrect ? "✅ Correct!" : "⚠️ Needs Revision"}</span>
              {result.bloomLevelDemonstrated && (
                <Badge variant="secondary" className="text-xs">
                  Bloom: {result.bloomLevelDemonstrated}
                </Badge>
              )}
            </AlertTitle>
            <AlertDescription className="space-y-2 mt-2 text-sm">
              <p>{result.feedback}</p>
              {result.socraticHint && (
                <div className="p-2.5 bg-background/80 rounded border text-xs mt-2">
                  <span className="font-bold">Coach Nudge:</span> {result.socraticHint}
                </div>
              )}
              {result.recommendedNextStep && (
                <div className="text-xs text-muted-foreground mt-2">
                  👉 Recommended: {result.recommendedNextStep.title}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Submission Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-4">
        <span className="text-xs text-muted-foreground">
          {activity.constraints?.maxAttempts
            ? `Max attempts: ${activity.constraints.maxAttempts}`
            : "Self-paced mastery"}
        </span>
        {!result && (
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (activity.activityType === "InteractiveQuiz" && selectedOptions.length === 0)
            }
          >
            {isSubmitting ? "Submitting..." : "Check Answer"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
