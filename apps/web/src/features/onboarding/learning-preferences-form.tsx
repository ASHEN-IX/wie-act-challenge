"use client";
import { useActionState, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { LearningProfile } from "@noveris/shared/ednova/learningProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  COLLABORATION_OPTIONS,
  FORMAT_OPTIONS,
  GOAL_OPTIONS,
  LANGUAGE_OPTIONS,
  LEVEL_OPTIONS,
  SESSION_LENGTH_OPTIONS,
  STUDY_TIME_OPTIONS,
} from "./options";
import { saveLearningPreferences, skipOnboarding } from "./actions";

type Option = { value: string; label: string };

function Choices({
  legend,
  hint,
  name,
  type,
  options,
  selected,
}: {
  legend: string;
  hint?: string;
  name: string;
  type: "checkbox" | "radio";
  options: ReadonlyArray<Option>;
  selected: ReadonlyArray<string | null>;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-base font-medium">{legend}</legend>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
          >
            <input
              type={type}
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LearningPreferencesForm({
  initial,
  mode,
  next = "/dashboard",
}: {
  initial: LearningProfile;
  mode: "onboarding" | "settings";
  next?: string;
}) {
  const [state, action, pending] = useActionState(saveLearningPreferences, {});
  const [step, setStep] = useState(0);
  const stepped = mode === "onboarding";

  const panels: Array<{ title: string; body: ReactNode }> = [
    {
      title: "What do you want to achieve?",
      body: (
        <Choices
          legend="Your goals"
          hint="Pick any that apply. You can change this later."
          name="goals"
          type="checkbox"
          options={GOAL_OPTIONS}
          selected={initial.goals}
        />
      ),
    },
    {
      title: "What are you learning?",
      body: (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="subjects" className="text-base font-medium">
              Subjects
            </label>
            <Input
              id="subjects"
              name="subjects"
              defaultValue={initial.subjects.join(", ")}
              placeholder="Linear algebra, organic chemistry"
              maxLength={400}
            />
            <p className="text-sm text-muted-foreground">Separate subjects with commas.</p>
          </div>
          <Choices
            legend="Your starting level"
            hint="Your own estimate. It is only a starting point, never a test result."
            name="selfReportedLevel"
            type="radio"
            options={LEVEL_OPTIONS}
            selected={[initial.selfReportedLevel]}
          />
        </div>
      ),
    },
    {
      title: "How do you like to learn?",
      body: (
        <div className="flex flex-col gap-6">
          <Choices
            legend="Explanation language"
            hint="The tutor starts with the first one listed and still follows the language you write in."
            name="languages"
            type="checkbox"
            options={LANGUAGE_OPTIONS}
            selected={initial.languages}
          />
          <Choices
            legend="What helps you most?"
            hint="Choose any. These guide suggestions; they never lock you in."
            name="formats"
            type="checkbox"
            options={FORMAT_OPTIONS}
            selected={initial.formats}
          />
        </div>
      ),
    },
    {
      title: "Your study habits",
      body: (
        <div className="flex flex-col gap-6">
          <Choices
            legend="Usual session length (minutes)"
            name="sessionMinutes"
            type="radio"
            options={SESSION_LENGTH_OPTIONS.map((m) => ({ value: String(m), label: `${m}` }))}
            selected={[initial.sessionMinutes ? String(initial.sessionMinutes) : null]}
          />
          <Choices
            legend="Best time to study"
            name="studyTime"
            type="radio"
            options={STUDY_TIME_OPTIONS}
            selected={[initial.studyTime]}
          />
          <Choices
            legend="You prefer studying"
            name="collaboration"
            type="radio"
            options={COLLABORATION_OPTIONS}
            selected={[initial.collaboration]}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-base font-medium">Accessibility (optional)</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="reduceMotion" defaultChecked={initial.reduceMotion} className="accent-primary" />
              Reduce motion
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="largeText" defaultChecked={initial.largeText} className="accent-primary" />
              Larger text
            </label>
          </fieldset>
        </div>
      ),
    },
  ];
  const last = step === panels.length - 1;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-8">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      {stepped && (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {panels.length}
          </p>
          <progress
            aria-label="Onboarding progress"
            value={step + 1}
            max={panels.length}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted accent-primary"
          />
        </div>
      )}
      {panels.map((panel, index) => (
        <section
          key={panel.title}
          hidden={stepped && index !== step}
          aria-labelledby={`pref-${index}`}
          className="flex flex-col gap-5"
        >
          <h2 id={`pref-${index}`} className="text-xl font-semibold tracking-tight">
            {panel.title}
          </h2>
          {panel.body}
        </section>
      ))}
      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.success && (
        <Alert role="status">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {stepped && step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {stepped && !last ? (
          <Button key="next" type="button" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          // A distinct key matters: without it React reuses the "Next" element and
          // flips it to type="submit" mid-click, which submits the form early.
          <Button key="finish" type="submit" disabled={pending}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
            {stepped ? "Finish" : "Save preferences"}
          </Button>
        )}
        {stepped && (
          <Button type="submit" variant="ghost" formAction={skipOnboarding} formNoValidate>
            Skip for now
          </Button>
        )}
      </div>
    </form>
  );
}
