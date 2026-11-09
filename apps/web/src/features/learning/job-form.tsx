"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActionForm, SubmitButton } from "@/components/shared/action-form";
import { AiWaitStatus } from "@/features/ai-status/ai-status-view";
import { readJob } from "./actions";
import type { ActionState, FormAction } from "@/lib/action-state";
const JOB_STATUS_LABELS: Record<string, string> = {
  completed: "Done",
  succeeded: "Done",
  failed: "This could not be completed.",
  cancelled: "Cancelled.",
  unavailable: "Unavailable right now.",
};
const jobIsWaiting = (status: string) =>
  !(status.toLowerCase() in JOB_STATUS_LABELS);
function ResultContent({ value }: { value: unknown }) {
  if (typeof value === "string")
    return <p className="whitespace-pre-wrap text-sm leading-7">{value}</p>;
  if (Array.isArray(value))
    return (
      <div className="flex flex-col gap-4">
        {value.slice(0, 30).map((item, i) => (
          <ResultContent value={item} key={i} />
        ))}
      </div>
    );
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value).filter(
    ([key]) =>
      ![
        "userId",
        "sessionId",
        "correlationId",
        "id",
        "createdAt",
        "updatedAt",
      ].includes(key),
  );
  return (
    <dl className="flex flex-col gap-4">
      {entries.slice(0, 30).map(([key, item]) => (
        <div key={key}>
          <dt className="mb-1 text-xs font-medium capitalize text-muted-foreground">
            {key.replaceAll("_", " ")}
          </dt>
          <dd>
            {typeof item === "number" || typeof item === "boolean" ? (
              String(item)
            ) : (
              <ResultContent value={item} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
const FEEDBACK_DIMENSIONS: Array<[string, string]> = [
  ["concept_coverage", "Covers the concept"],
  ["logical_coherence", "Reasoning hangs together"],
  ["causal_reasoning", "Explains why"],
  ["error_awareness", "Notices mistakes"],
  ["specificity", "Specific detail"],
];
const asNumber = (value: unknown) => (typeof value === "number" ? value : null);
const asList = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Practice feedback for a learner: a short message and a few labelled scores, not the raw job. */
function PracticeResult({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return <ResultContent value={value} />;
  const r = value as Record<string, unknown>;
  const dims =
    r.evaluation_output && typeof r.evaluation_output === "object"
      ? (r.evaluation_output as Record<string, unknown>)
      : {};
  const score = asNumber(r.mastery_score);
  const message = typeof r.message === "string" ? r.message : "";
  const feedback = typeof r.feedback === "string" ? r.feedback : "";
  const weak = asList(r.weak_concepts);
  const misconceptions = asList(r.misconceptions);
  return (
    <div className="flex flex-col gap-3 text-sm">
      {message && <p>{message}</p>}
      {feedback && <p className="text-muted-foreground">{feedback}</p>}
      {score !== null && (
        <p>
          Score for this explanation: <strong>{score.toFixed(2)}</strong> out of 1
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {FEEDBACK_DIMENSIONS.map(([key, label]) => {
          const n = asNumber(dims[key]);
          return n === null ? null : (
            <li key={key}>
              {label}: {n.toFixed(2)}
            </li>
          );
        })}
      </ul>
      {weak.length > 0 && <p>Concepts to revisit: {weak.join(", ")}</p>}
      {misconceptions.length > 0 && (
        <p>Possible misunderstandings: {misconceptions.join(", ")}</p>
      )}
      <p className="text-muted-foreground">
        This is feedback on your explanation, not a grade. Check it against your
        course sources.
      </p>
    </div>
  );
}
export function JobForm({
  action,
  kind,
  children,
  submit,
  finalize,
}: {
  action: FormAction;
  finalize?: FormAction;
  kind: "eval" | "search" | "ai";
  children: ReactNode;
  submit: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [resumed, setResumed] = useState<ActionState>({});
  const [pollVersion, setPollVersion] = useState(0);
  const jobId = state.jobId || resumed.jobId;
  const correlationId = state.jobId ? state.correlationId : resumed.correlationId;
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    if (params.get("jobKind") === kind) setResumed({
      jobId: params.get("job") || undefined,
      correlationId: params.get("correlation") || undefined,
    });
  }, [kind]);
  useEffect(() => {
    if (!state.jobId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("job", state.jobId);
    url.searchParams.set("jobKind", kind);
    if (state.correlationId) url.searchParams.set("correlation", state.correlationId);
    else url.searchParams.delete("correlation");
    window.history.replaceState(window.history.state, "", url);
  }, [state.jobId, state.correlationId, kind]);
  const [job, setJob] = useState<{
    status: string;
    result?: unknown;
    error?: string;
    fallbackUsed?: boolean;
  }>();
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    const poll = async () => {
      try {
        const result = await readJob(kind, jobId);
        if (cancelled) return;
        const status = result.status.toLowerCase();
        setJob({
          ...result,
          error: result.error
            ? "This could not be completed. Check your input and try again."
            : undefined,
        });
        if (["completed", "succeeded", "failed", "cancelled"].includes(status))
          return;
        if (++count >= 60) {
          setJob({
            status: "pending",
            error:
              "Still waiting. Your request is saved. Use Check status or return to this page later.",
          });
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch {
        if (!cancelled)
          setJob({
            status: "unavailable",
            error: "Unable to check this job. Try again later.",
          });
      }
    };
    setJob({ status: "pending" });
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, kind, pollVersion]);
  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-5">
        {children}
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <div>
          <SubmitButton>{submit}</SubmitButton>
        </div>
      </form>
      {job && (
        <section
          aria-live="polite"
          className="flex flex-col gap-4 rounded-lg border p-6"
        >
          <h2 className="font-semibold">
            {kind === "eval" ? "Your feedback" : "Results"}
          </h2>
          {jobIsWaiting(job.status) ? (
            <AiWaitStatus />
          ) : (
            <p className="text-sm text-muted-foreground">
              {JOB_STATUS_LABELS[job.status.toLowerCase()]}
              {job.fallbackUsed ? " · Built-in guidance was used" : ""}
            </p>
          )}
          <button type="button" className="self-start text-sm underline underline-offset-4" onClick={() => setPollVersion((value) => value + 1)}>Check status</button>
          {job.error && <p className="text-sm text-destructive">{job.error}</p>}
          {job.result != null &&
            (kind === "eval" ? (
              <PracticeResult value={job.result} />
            ) : (
              <ResultContent value={job.result} />
            ))}
          {finalize &&
            correlationId &&
            job.status.toLowerCase() === "completed" && (
              <ActionForm action={finalize} submit="Save plan and tasks">
                <input
                  type="hidden"
                  name="correlationId"
                  value={correlationId}
                />
              </ActionForm>
            )}
        </section>
      )}
    </div>
  );
}
