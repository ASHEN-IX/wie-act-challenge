"use client";
import { useState, useTransition } from "react";
import { Lightbulb, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AiModeNote, AiWaitStatus } from "@/features/ai-status/ai-status-view";
import type { PublicVisualLab } from "./contracts";
import { askLabGuide, submitLabCheck } from "./actions";
import { GraphLab } from "./graph-lab";
import { ParameterLab } from "./parameter-lab";
import { FunctionLab } from "./function-lab";
import { SpatialLab } from "./spatial-lab";

type GuideMessage = { role: "learner" | "guide"; text: string; mode?: string };
type CheckState = {
  selected: string | null;
  result: Awaited<ReturnType<typeof submitLabCheck>> | null;
  error?: string;
};

const GUIDANCE_MODES = [
  { id: "explain", label: "Explain what happened" },
  { id: "hint", label: "Give me a hint" },
  { id: "next", label: "What should I try next?" },
  { id: "challenge", label: "Challenge me" },
] as const;

export function LabWorkspace({ lab }: { lab: PublicVisualLab }) {
  const [parameters, setParameters] = useState<unknown>(undefined);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [check, setCheck] = useState<CheckState>({
    selected: null,
    result: null,
  });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [checkPending, startCheck] = useTransition();

  // The check question is written against the lab as generated. Once the learner
  // edits the experiment, say so rather than leave a stale answer looking current.
  const edited =
    lab.definition.engine === "weighted_graph"
      ? Array.isArray(parameters) &&
        parameters.some(
          (w, i) =>
            w !==
            (lab.definition.scenario as { edges: { weight: number }[] }).edges[
              i
            ]?.weight,
        )
      : parameters !== undefined &&
        JSON.stringify(parameters) !==
          JSON.stringify(
            (lab.definition.scenario as { values: unknown }).values,
          );

  const fallbackExample = lab.generationMode === "DETERMINISTIC_FALLBACK";

  function ask(mode: (typeof GUIDANCE_MODES)[number]["id"], text?: string) {
    const asked = (text ?? question).trim();
    if (!asked) {
      setError("Type a question or choose a prompt.");
      return;
    }
    setError("");
    const prompt = text ? "" : question;
    setMessages((all) => [...all, { role: "learner", text: asked }]);
    if (prompt) setQuestion("");
    startTransition(async () => {
      try {
        const reply = await askLabGuide(lab.labId, {
          question: asked,
          guidanceMode: mode,
          parameters,
        });
        setMessages((all) => [
          ...all,
          { role: "guide", text: reply.text, mode: reply.executionMode },
        ]);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The guide is unavailable. Your simulation still works.",
        );
      }
    });
  }

  function answer(optionId: string) {
    setCheck({ selected: optionId, result: null });
    startCheck(async () => {
      try {
        const result = await submitLabCheck(lab.labId, optionId);
        setCheck({ selected: optionId, result });
      } catch (caught) {
        setCheck({
          selected: optionId,
          result: null,
          error:
            caught instanceof Error
              ? caught.message
              : "The answer could not be checked.",
        });
      }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="lab-context" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {lab.engine === "weighted_graph"
                ? "Weighted graph"
                : lab.engine === "spatial_3d"
                  ? "3D explorer"
                  : lab.engine === "function_plot"
                    ? "Function plot"
                    : "Parameter experiment"}
            </Badge>
            <Badge variant={fallbackExample ? "outline" : "secondary"}>
              {fallbackExample
                ? "Built-in example · AI planner unavailable"
                : "AI-planned experiment"}
            </Badge>
            <Badge variant="secondary">
              {lab.sourceContext.mode === "course"
                ? "Course-grounded"
                : "Topic example · not from a course"}
            </Badge>
          </div>
          <h2 id="lab-context" className="text-xl font-semibold tracking-tight">
            {lab.concept}
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            {lab.learningObjective}
          </p>
          <p className="max-w-2xl text-sm leading-7">
            {lab.guidance.instructions}
          </p>
        </section>

        <section
          aria-labelledby="lab-simulation"
          className="rounded-xl border p-4 sm:p-6"
        >
          <h2
            id="lab-simulation"
            className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Simulation
          </h2>
          {lab.definition.engine === "weighted_graph" ? (
            <GraphLab
              scenario={lab.definition.scenario}
              onStateChange={setParameters}
            />
          ) : lab.definition.engine === "function_plot" ? (
            <FunctionLab
              scenario={lab.definition.scenario}
              onStateChange={setParameters}
            />
          ) : lab.definition.engine === "spatial_3d" ? (
            <SpatialLab
              scenario={lab.definition.scenario}
              onStateChange={setParameters}
            />
          ) : (
            <ParameterLab
              scenario={lab.definition.scenario}
              onStateChange={setParameters}
            />
          )}
        </section>

        <section
          aria-labelledby="lab-check"
          className="flex flex-col gap-4 rounded-xl border p-4 sm:p-6"
        >
          <h2
            id="lab-check"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Check your understanding
          </h2>
          <p className="text-sm font-medium">{lab.check.prompt}</p>
          {edited && (
            <p className="text-xs leading-5 text-muted-foreground" role="note">
              This question uses the values the lab started with, not your
              edits. Reset the experiment to match it.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {lab.check.options.map((option) => {
              const chosen = check.selected === option.id;
              const revealed = check.result?.correctOptionId === option.id;
              const wrong = chosen && check.result && !check.result.correct;
              return (
                <li key={option.id}>
                  <Button
                    variant={chosen || revealed ? "secondary" : "outline"}
                    className={`h-auto w-full justify-start whitespace-normal py-2 text-left ${
                      wrong ? "border-destructive text-destructive" : ""
                    } ${revealed ? "border-primary" : ""}`}
                    aria-pressed={chosen}
                    disabled={checkPending}
                    onClick={() => answer(option.id)}
                  >
                    {option.label}
                  </Button>
                </li>
              );
            })}
          </ul>
          {check.result && (
            <Alert role="status">
              <AlertDescription>
                <strong>
                  {check.result.correct ? "Correct." : "Not quite."}
                </strong>{" "}
                {check.result.explanation}{" "}
                <span className="text-muted-foreground">
                  This practice check does not change your mastery or XP.
                </span>
              </AlertDescription>
            </Alert>
          )}
          {check.error && (
            <p role="alert" className="text-sm text-destructive">
              {check.error}
            </p>
          )}
        </section>
      </div>

      <aside
        aria-labelledby="lab-guide"
        className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start"
      >
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <h2
            id="lab-guide"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Sparkles className="size-4 text-primary" aria-hidden />
            Ask the guide
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            The guide sees the values computed by this simulation, not its own
            guesswork.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {GUIDANCE_MODES.map((mode) => (
              <Button
                key={mode.id}
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => ask(mode.id, mode.label)}
              >
                {mode.label}
              </Button>
            ))}
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              ask("explain");
            }}
          >
            <label htmlFor="lab-question" className="text-xs font-medium">
              Your question
            </label>
            <Textarea
              id="lab-question"
              value={question}
              maxLength={1000}
              rows={3}
              placeholder={lab.guidance.predictionPrompt}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={pending}>
              <MessageCircleQuestion className="size-4" aria-hidden />
              Ask why
            </Button>
          </form>
          {pending && <AiWaitStatus />}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div aria-live="polite" className="flex flex-col gap-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "learner"
                    ? "rounded-lg bg-muted/60 px-3 py-2 text-sm"
                    : "rounded-lg border px-3 py-2 text-sm leading-6"
                }
              >
                {message.role === "guide" ? (
                  <>
                    <p>{message.text}</p>
                    {message.mode && <AiModeNote mode={message.mode} />}
                  </>
                ) : (
                  <p>{message.text}</p>
                )}
              </div>
            ))}
          </div>
          {!messages.length && (
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {lab.guidance.hint}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-dashed p-4 text-xs leading-5 text-muted-foreground">
          <p className="font-medium text-foreground">Where this comes from</p>
          {lab.sourceContext.mode === "course" ? (
            <p>
              Grounded in the published course revision
              {lab.sourceContext.passageIds?.length
                ? ` (${lab.sourceContext.passageIds.length} verified passage${
                    lab.sourceContext.passageIds.length === 1 ? "" : "s"
                  })`
                : ""}
              . Citations are never invented; if the sources do not support a
              point, the guide should say so.
            </p>
          ) : (
            <p>
              This is a general educational example for the topic you entered.
              It is not grounded in, or attributed to, any course.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
