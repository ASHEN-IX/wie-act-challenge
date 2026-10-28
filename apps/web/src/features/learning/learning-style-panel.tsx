"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  loadLearningStyle,
  saveLearningStyle,
  type LearningStyleProfile,
  type LearningStyleQuestion,
} from "./journey-actions";

export const STYLE_LABELS: Record<string, string> = {
  visual: "sketches and diagrams",
  analogy: "comparisons with things you know",
  step_by_step: "one step at a time",
  example: "worked examples",
  repetition: "restating and repeating",
  problem_solving: "working backwards from the goal",
};

/** Optional, private preference that only changes how hints are phrased. */
export function LearningStylePanel() {
  const [questions, setQuestions] = useState<LearningStyleQuestion[]>([]);
  const [profile, setProfile] = useState<LearningStyleProfile>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadLearningStyle()
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.questions);
        setProfile(data.profile);
      })
      .catch(() => {
        if (!cancelled) setError("Hint style is unavailable right now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const complete =
    questions.length > 0 && questions.every((q) => answers[q.id]);
  const showQuestions = !profile || editing;

  async function save() {
    setBusy(true);
    setError("");
    try {
      setProfile(await saveLearningStyle(answers));
      setEditing(false);
      setAnswers({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your answers.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">
        Match hints to how you learn (optional)
      </summary>
      <div className="mt-3 space-y-4">
        <p className="text-muted-foreground">
          Six quick questions. Your answers only change how hints are worded.
          They stay private and never affect grades or progress.
        </p>
        {error && <p role="alert">{error}</p>}
        {profile && !editing && (
          <p role="status">
            Hints currently lean on{" "}
            <strong>{STYLE_LABELS[profile.primary] ?? profile.primary}</strong>.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setEditing(true)}
            >
              Retake
            </button>
          </p>
        )}
        {showQuestions &&
          questions.map((q) => (
            <fieldset key={q.id} className="space-y-1">
              <legend className="font-medium">{q.prompt}</legend>
              {q.options.map((o) => (
                <label key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`style-${q.id}`}
                    value={o.id}
                    checked={answers[q.id] === o.id}
                    onChange={() =>
                      setAnswers((current) => ({ ...current, [q.id]: o.id }))
                    }
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>
          ))}
        {showQuestions && questions.length > 0 && (
          <Button disabled={busy || !complete} onClick={save}>
            Save hint style
          </Button>
        )}
      </div>
    </details>
  );
}
